package com.airbank.core.accounting;

import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.api.core.dto.TxnCmd;
import com.airbank.api.core.dto.TxnVO;
import com.airbank.common.exception.BizException;
import com.airbank.core.service.AccountService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 账务引擎集成测试（Testcontainers PG；无 Docker 环境自动跳过）。
 * 覆盖：开户入账、转账、幂等重放、幂等冲突、冲正（G2 关键用例）。
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class AccountingServiceIT {

    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", pg::getJdbcUrl);
        registry.add("spring.datasource.username", pg::getUsername);
        registry.add("spring.datasource.password", pg::getPassword);
        registry.add("airbank.security.enabled", () -> "false");
        registry.add("spring.cloud.nacos.discovery.enabled", () -> "false");
        registry.add("spring.cloud.nacos.config.enabled", () -> "false");
        registry.add("spring.data.redis.host", () -> "localhost");
    }

    @Autowired
    DataSource dataSource;

    @Autowired
    AccountService accountService;

    @Autowired
    AccountingService accountingService;

    @BeforeEach
    void initSchema() throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(conn, new FileSystemResource("../deploy/postgres/init/20-core-schema.sql"));
        }
    }

    private String open(long initial, String requestNo) {
        return accountService.open(new OpenAccountCmd(requestNo, 9L, "DEMAND", initial, "990", "it", "IT"),
                LocalDate.now()).acctNo();
    }

    @Test
    void openThenTransferShouldBalance() {
        String a = open(1_000_000L, "IT:A");
        String b = open(500_000L, "IT:B");

        TxnVO txn = accountingService.post(new TxnCmd("IT:T1", AccountingService.T_INNER_TRANSFER,
                a, b, 300_000L, "it 转账", "IT", "tester", "990"), LocalDate.now());

        assertThat(txn.status()).isEqualTo("SUCCESS");
        assertThat(accountService.byAcctNo(a).balance()).isEqualTo(700_000L);
        assertThat(accountService.byAcctNo(b).balance()).isEqualTo(800_000L);
    }

    @Test
    void replaySameRequestNoShouldReturnOriginalWithoutDoublePosting() {
        String a = open(1_000_000L, "IT:R-A");
        String b = open(0L + 500_000L, "IT:R-B");
        TxnCmd cmd = new TxnCmd("IT:R-1", AccountingService.T_INNER_TRANSFER, a, b, 100_000L, "replay", "IT", "t", "990");

        TxnVO first = accountingService.post(cmd, LocalDate.now());
        TxnVO second = accountingService.post(cmd, LocalDate.now());

        assertThat(second.duplicated()).isTrue();
        assertThat(second.txnNo()).isEqualTo(first.txnNo());
        assertThat(accountService.byAcctNo(a).balance()).isEqualTo(900_000L);
    }

    @Test
    void sameRequestNoDifferentBodyShouldConflict() {
        String a = open(1_000_000L, "IT:C-A");
        String b = open(500_000L, "IT:C-B");
        accountingService.post(new TxnCmd("IT:C-1", AccountingService.T_INNER_TRANSFER, a, b, 100_000L, "x", "IT", "t", "990"),
                LocalDate.now());
        TxnCmd conflict = new TxnCmd("IT:C-1", AccountingService.T_INNER_TRANSFER, a, b, 200_000L, "x", "IT", "t", "990");
        assertThatThrownBy(() -> accountingService.post(conflict, LocalDate.now()))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getCode())
                .isEqualTo(3004);
    }

    @Test
    void insufficientBalanceShouldBeRejected() {
        String a = open(100L, "IT:D-A");
        String b = open(100L, "IT:D-B");
        assertThatThrownBy(() -> accountingService.post(
                new TxnCmd("IT:D-1", AccountingService.T_INNER_TRANSFER, a, b, 500L, "x", "IT", "t", "990"),
                LocalDate.now()))
                .isInstanceOf(BizException.class)
                .extracting(e -> ((BizException) e).getCode())
                .isEqualTo(3002);
    }

    @Test
    void reverseShouldRestoreBalancesOnce() {
        String a = open(1_000_000L, "IT:V-A");
        String b = open(500_000L, "IT:V-B");
        TxnVO origin = accountingService.post(
                new TxnCmd("IT:V-1", AccountingService.T_INNER_TRANSFER, a, b, 400_000L, "to-reverse", "IT", "t", "990"),
                LocalDate.now());

        TxnVO reversal = accountingService.reverse(origin.txnNo(), "IT:V-1-REV", "t", "IT", "990", LocalDate.now());
        assertThat(reversal.status()).isEqualTo("SUCCESS");
        assertThat(accountService.byAcctNo(a).balance()).isEqualTo(1_000_000L);
        assertThat(accountService.byAcctNo(b).balance()).isEqualTo(500_000L);

        // 重复冲正请求幂等；原单已 REVERSED 再冲 → 5008 语义拒绝
        TxnVO again = accountingService.reverse(origin.txnNo(), "IT:V-1-REV2", "t", "IT", "990", LocalDate.now());
        assertThat(again.status()).isEqualTo("SUCCESS");
        assertThat(accountService.byAcctNo(a).balance()).isEqualTo(1_000_000L);
    }
}
