# 卫戍协议单人 Lv20 独立玩家 solo-lv20-stage-4

解压后使用 Node.js 24.22 或更高版本运行，游戏规则、战斗引擎和决策权重均已随包提供。

```powershell
node play.mjs
node play.mjs --seed 42 --count 1
node play.mjs --band band_jesica
node play.mjs --band random --trace --output game.jsonl
```

接口支持自主选择策略、指派策略或从单人可用策略均匀抽签。每局输出官方胜负和实际选定的策略。集成到已有对局时，可从 release.json 所列玩家模块创建控制器，然后输入当前公开局面及自己的手牌。
