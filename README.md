#### 注册中心：Nacos
#### 网关服务：Gateway
#### 三个微服务：
- air-bank-core（核心服务）
- air-bank-ecif（客户服务） 
- air-bank-online（网银服务，含前端）
```shell
air-bank-demo/
├── README.md
├── pom.xml                         <- 父项目
├── nacos/                          <- Nacos 注册中心配置（推荐单独部署）
├── gateway-server/                 <- 网关服务（Spring Cloud Gateway）
│   └── pom.xml
├── air-bank-core/                  <- 核心服务
│   └── pom.xml
├── air-bank-ecif/                  <- 客户信息服务
│   └── pom.xml
├── air-bank-online/                <- 网银服务（含API）
│   ├── pom.xml
│   └── frontend/                   <- 前端项目（React）
│       ├── package.json
│       └── ...
└── air-bank-common/                <- 公共模块（实体类、常量等）
    └── pom.xml
```

## 注册中心
> 推荐使用官方镜像快速启动 Nacos

### 方法1：使用较旧版本（无需认证）
```shell
docker run -d --name nacos -e MODE=standalone -p 8848:8848 nacos/nacos-server:v2.2.3

# 默认访问地址：http://localhost:8848/nacos
# 默认用户名密码：nacos/nacos
```

### 方法2：使用最新版本（需要完整认证配置）
```shell
# 启动 Nacos（包含完整的认证配置）
docker run -d --name nacos-server -p 8080:8080 -p 8848:8848 -p 9848:9848 -e MODE=standalone -e NACOS_AUTH_TOKEN=nYP2R9hEHfNI5EKLC4RRbhdrOBpiEPh7vLcxIsvTpVk27u3ncuWtRS+L0yENvorEBm66Fyv1J8XihM2sg4X47w== -e NACOS_AUTH_IDENTITY_KEY=233eaec3ea929c3ebbab93244b398855 -e NACOS_AUTH_IDENTITY_VALUE=d69762888570122b1e53d237d02dcada7d437fb11013ada3c0cd1228c67debd6 --restart=always nacos/nacos-server:v3.0.2

docker run --name nacos-server \
    -e MODE=standalone \
    -e NACOS_AUTH_TOKEN=nYP2R9hEHfNI5EKLC4RRbhdrOBpiEPh7vLcxIsvTpVk27u3ncuWtRS+L0yENvorEBm66Fyv1J8XihM2sg4X47w== \
    -e NACOS_AUTH_IDENTITY_KEY=233eaec3ea929c3ebbab93244b398855 \
    -e NACOS_AUTH_IDENTITY_VALUE=d69762888570122b1e53d237d02dcada7d437fb11013ada3c0cd1228c67debd6 \
    -p 8080:8080 \
    -p 8848:8848 \
    -p 9848:9848 \
    -d nacos/nacos-server:v3.0.2

# 默认访问地址：http://localhost:8080
```

### 方法3：使用 Docker Compose
```shell
cd air-bank/docker
docker-compose -f docker-compose-nacos.yaml up -d
```