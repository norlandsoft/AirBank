# 设计偏差记录（deviation.md）

> 依据 docs/implementation-plan.md §9「执行机制」：实现与设计文档不一致之处必须在此登记，
> 含原因与影响评估。设计文档不随之修改（保持 v1.0 基线）。

| # | 日期 | 偏差 | 原因 | 影响 |
|---|---|---|---|---|
| D-01 | 2026-09-10 | 菜单树改为代码内定义（uam `MenuService`），权限表仅存 ACTION 操作点 | 菜单结构稳定且量小，入库维护成本高于收益；RBAC 校验语义不变（perms 全量入 JWT） | 低：前端菜单过滤逻辑不变；新增菜单需发版 |
| D-02 | 2026-09-10 | 种子数据由各服务 Java Seeder（幂等 ApplicationRunner）灌入，而非纯 SQL | 编号含 Luhn 校验位、密码 BCrypt、敏感字段 AES，SQL 复算困难且易漂移 | 低：`deploy/postgres/init` 仍负责建库建表；种子随服务首启自动创建 |
| D-03 | 2026-09-10 | 网关限流以内置滑动窗口过滤器实现，Sentinel 延后 | 培训环境无需控制台依赖，减少启动失败面；限流语义（200 QPS/IP）保持 | 低：`docs/design/02` §10 的 Sentinel 项移入二期 |
| D-04 | 2026-09-10 | 可观测性 profile 首版含 Zipkin/Prometheus/Grafana，Loki 延后（日志用 `docker compose logs`） | Loki 需额外采集端（promtail/docker plugin），部署复杂度/收益比低 | 低：链路与指标完好；日志聚合二期补 |
| D-05 | 2026-09-10 | 领域服务依赖自身 api 模块的 DTO（不复用其 Feign 接口） | 单一事实源消除 DTO 重复定义；原设计关注点是契约泄漏，禁用 Feign 接口复用即可 | 无 |
| D-06 | 2026-09-10 | OTP「查看验证码」经 uam internal 接口实现（而非消息中心落库） | 消息中心在 ebank 库，uam 反向写违反服务边界；internal 接口仅内网可达且校验归属 | 低：培训体验一致 |
| D-07 | 2026-09-10 | 前端 msw 双轨未实现（直连网关联调） | 后端与前端同仓同步开发，mock 价值降低 | 低：doc 10 §7 的 mock 开关延后 |
| D-08 | 2026-09-10 | 客户证件唯一性以 SHA-256 哈希列等值查询（密文 AES-GCM 随机 IV 不可等值查） | 加密列无法索引查询，增加 hash 列为行业标准做法 | 低：uam 表增加 id_no_hash/mobile_hash 列 |
| D-09 | 2026-09-10 | 柜面多页签工作区（doc 10 §3）简化为标准路由页面 | 首版交付以功能覆盖优先 | 低：交互增强项入二期 |

| D-10 | 2026-09-10 | 后端运行时镜像由 `eclipse-temurin:17-jre-alpine` 改为 `17-jre-jammy`（内置 curl） | alpine 变体无 arm64 发布，Apple Silicon/多架构不可构建 | 低：镜像略大；健康检查用 curl |
| D-11 | 2026-09-10 | 前端两应用各自带独立 pnpm-workspace（未并入根工作区构建链） | Docker 构建上下文自包含要求 + esbuild 安装脚本许可 | 低：根 workspace 仍保留供本地联跑 |
| D-12 | 2026-09-10 | 柜面申请单 DRAFT 暂存未实现（受理即提交） | 首版以功能闭环优先 | 低：交互增强项入二期 |
| D-13 | 2026-09-10 | 非主管复核返回 2007（NO_PERMISSION）而非 5005 | 权限校验统一由 @RequirePerm 拦截器抛出 | 无：语义等价 |
| D-14 | 2026-09-10 | 定期提前支取对外返回本金交易（利息交易按 requestNo 后缀 :I 可查） | CoreClient 契约为单笔 TxnVO | 低：两笔分录均落账 |
| D-15 | 2026-09-10 | 柜面 JSONB 字段写入要求数据源 URL 附加 `?stringtype=unspecified` | PG JDBC 默认将 Map 参数按 varchar 传给 jsonb 列报错 | 低：已固化在 counter 的 application.yaml |

| D-16 | 2026-09-11 | 父 POM 开启 `maven.compiler.parameters` | Spring 6.1 不再从字节码局部变量表推导参数名，`@RequestParam` 无显式 name 时 500 | 修复后全链路回归通过 |
| D-17 | 2026-09-11 | `GlobalExceptionHandler` 纳入 AutoConfiguration.imports | 此前未自动装配，业务异常被包成 HTTP 500 | 修复后业务错误码正确透传（如 4002/4003） |
| D-18 | 2026-09-11 | nacos-init 发布 dataId 保留 `.yaml` 后缀 | 与 `spring.config.import: nacos:airbank-xxx.yaml` 引用一致，此前服务读到空配置 | 修复后动态配置（网关白名单等）生效 |
| D-19 | 2026-09-11 | PG init 脚本补 `GRANT ALL ON ALL TABLES/SEQUENCES + DEFAULT PRIVILEGES` | 建表归 superuser，应用账号无权限 | 修复后各服务正常建表访问 |
| D-20 | 2026-09-11 | core `ReportMapper` 聚合别名加引号、日期参数改 `LocalDate`、批量步骤日志截断 450 字符 | PG 小写化别名致 Map 键错位；date≠varchar；超长异常信息掩盖根因 | 修复后日终批量 7 步全通 |
| D-21 | 2026-09-11 | counter-web nginx `/api` 反代曾被注释；uam 数据源补 `stringtype=unspecified`；uam setval 改 @Select | 前端 API 请求被 SPA 回退吞掉；JSONB 写入类型；PG JDBC 不允许 @Update 执行 SELECT | 修复后柜面 UI 全链路与种子数据正常 |
| D-22 | 2026-09-11 | compose 增加可配置宿主机端口（.env：PG/Redis/Grafana） | 规避与宿主机既有服务的端口冲突 | 无功能影响 |
