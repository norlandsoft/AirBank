package com.airbank.core.seed;

import com.airbank.api.core.dto.OpenAccountCmd;
import com.airbank.api.core.dto.TimeDepositCmd;
import com.airbank.common.exception.BizException;
import com.airbank.core.accounting.AccountingService;
import com.airbank.core.entity.Account;
import com.airbank.core.entity.GlSubject;
import com.airbank.core.mapper.AccountMapper;
import com.airbank.core.mapper.GlSubjectMapper;
import com.airbank.core.service.AccountService;
import com.airbank.core.service.TimeDepositService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * 种子数据（幂等）：会计科目 + 演示客户账户（期初开业注资 OPENING 入账，保证总分可核对）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

    private final GlSubjectMapper subjectMapper;
    private final AccountMapper accountMapper;
    private final AccountService accountService;
    private final TimeDepositService timeDepositService;

    private static final String[][] SUBJECTS = {
            {"1010", "库存现金", "ASSET", "DR"},
            {"2011", "个人活期存款", "LIABILITY", "CR"},
            {"2012", "个人定期存款", "LIABILITY", "CR"},
            {"2061", "代理理财资金", "LIABILITY", "CR"},
            {"6011", "利息支出-存款利息", "EXPENSE", "DR"},
            {"6012", "利息支出-理财收益", "EXPENSE", "DR"},
            {"6051", "中间业务收入", "INCOME", "CR"}};

    @Override
    public void run(ApplicationArguments args) {
        if (subjectMapper.selectCount(null) == 0) {
            for (String[] s : SUBJECTS) {
                GlSubject subj = new GlSubject();
                subj.setSubjectCode(s[0]);
                subj.setSubjectName(s[1]);
                subj.setCategory(s[2]);
                subj.setDirection(s[3]);
                subj.setStatus("ACTIVE");
                subjectMapper.insert(subj);
            }
            log.info("[seed] GL subjects ready");
        }
        if (accountMapper.selectCount(null) > 0) {
            return;
        }
        log.info("[seed] seeding demo accounts ...");
        LocalDate today = LocalDate.now();
        // customer_id 与 uam 种子对齐：1 张三 / 2 李四 / 3 王五
        openSeed(1L, 5_000_000L, today);   // 张三 ¥50,000.00
        openSeed(2L, 12_000_000L, today);  // 李四 ¥120,000.00
        openSeed(3L, 800_000L, today);     // 王五 ¥8,000.00
        // 张三 1 年期存单 ¥20,000.00
        Account zhang = accountMapper.selectOne(new LambdaQueryWrapper<Account>()
                .eq(Account::getCustomerId, 1L).eq(Account::getAcctType, Account.TYPE_DEMAND));
        try {
            timeDepositService.create(new TimeDepositCmd("SEED:TD:1", zhang.getAcctNo(), 12, 2_000_000L,
                    "seed", "BATCH"), today);
        } catch (BizException e) {
            log.warn("[seed] time deposit skipped: {}", e.getMessage());
        }
        log.info("[seed] demo accounts ready (zhangsan ¥50,000 + TD ¥20,000 / lisi ¥120,000 / wangwu ¥8,000)");
    }

    private void openSeed(Long customerId, long initial, LocalDate date) {
        try {
            accountService.open(new OpenAccountCmd("SEED:OPEN:" + customerId, customerId,
                    Account.TYPE_DEMAND, initial, "990", "seed", "BATCH"), date);
        } catch (DuplicateKeyException | BizException e) {
            log.warn("[seed] account for customer {} skipped: {}", customerId, e.getMessage());
        }
    }
}
