package com.airbank.core.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface ReportMapper {

    // 别名带引号：防止 PG 将驼峰别名小写化，导致 Map 键不匹配
    @Select("SELECT subject_code AS \"subjectCode\", SUM(CASE WHEN dr_cr='DR' THEN amount ELSE 0 END) AS \"drSum\", "
            + "SUM(CASE WHEN dr_cr='CR' THEN amount ELSE 0 END) AS \"crSum\" "
            + "FROM t_journal WHERE batch_date=#{date} GROUP BY subject_code ORDER BY subject_code")
    List<Map<String, Object>> journalSumBySubject(java.time.LocalDate date);

    @Select("SELECT channel AS \"channel\", COUNT(*) AS \"cnt\", SUM(amount) AS \"amount\" FROM t_transaction "
            + "WHERE batch_date=#{date} AND status='SUCCESS' GROUP BY channel")
    List<Map<String, Object>> txnSumByChannel(java.time.LocalDate date);

    @Select("SELECT COALESCE(SUM(amount),0) FROM t_transaction WHERE batch_date=#{date} AND status='SUCCESS' "
            + "AND channel IN ('COUNTER','BATCH') AND txn_type IN ('CASH_DEPOSIT')")
    Long counterCashIn(java.time.LocalDate date);

    @Select("SELECT COALESCE(SUM(amount),0) FROM t_transaction WHERE batch_date=#{date} AND status='SUCCESS' "
            + "AND channel IN ('COUNTER','BATCH') AND txn_type IN ('CASH_WITHDRAW')")
    Long counterCashOut(java.time.LocalDate date);
}
