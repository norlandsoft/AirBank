# Benchmark 压测脚本

JMeter 5.6 脚本（docs/design/11 §4）。验收基线：转账 ≥200 TPS、P99 < 300ms，压后总分核对平衡。

## 准备

1. 部署全行后造数：柜面 admin 登录 → 造数工厂生成足够客户/账户（或直接选两个种子账户）。
2. 取一个柜面/管理 JWT（登录后复制 token），或开发签发的测试 token。

## 转账压测

```bash
jmeter -n -t benchmark/transfer.jmx \
  -JfromAcct=<付款账号> -JtoAcct=<收款账号> -Jtoken=<JWT> \
  -l benchmark/result.jtl -e -o benchmark/report
```

> 脚本中线程数/循环次数可在 JMeter GUI 打开调整（默认 100 线程 × 20 次）。
> 压测完成后执行日终批量 + `GET /api/core/batch/recon-report` 校验账务平衡（S13）。

## 注意

- 单一付款账户会形成行锁热点，属预期行为；大吞吐测试请用造数工厂生成账户池后分桶压测。
- 压测会产生真实流水，测试后建议 `scripts/reset.sh` 重置环境。
