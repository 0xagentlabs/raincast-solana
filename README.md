# RainCast

Solana Devnet 天气预测市场 Demo。用户预测上海未来 30 分钟内是否达到 0.1 mm 降水；Open‑Meteo 数据由受控预言机签名并用于链上结算。每个市场开放预测 25 分钟、在第 30 分钟结算，页面和链上 schedule PDA 都会阻止创建时间重叠的市场。

运营方地址：`Dy6mBH4YeqJCRZohd39iSFaf4jyLaxPeBakbZwt1jToL`。连接该钱包后可在到期市场卡片中直接获取天气并签名结算。

> 仅供技术演示。使用 Devnet 测试 SOL，不构成博彩或投资服务。

## 快速开始

```bash
pnpm install --ignore-scripts
pnpm --dir app dev
```

Program ID: `BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH`。完整 ABI 见 `ABI.md`，操作和安全说明见 `docs/项目使用说明书.md`。

- App: https://raincast-solana-0xcevin-5020s-projects.vercel.app
- Explorer: https://explorer.solana.com/address/BbkDnkPC7HD8TeNHp3iCDwjLxF3WDmg2Yrh9gVZrwohH?cluster=devnet
