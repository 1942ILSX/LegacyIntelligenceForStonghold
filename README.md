# 卫戍协议 · 单人 Lv20 独立 AI

这是《明日方舟》「卫戍协议：盟约」非官方模拟器的第五版独立玩家。它从开局选盟约和策略开始，自行完成招募、升级、装备、指挥、上阵与布阵，直至正式引擎结算。在 512 个全新、未按难度筛选的自主开局中通关 **376 局（73.4%）**。

## 运行一局

准备 Node.js **24.22 或更高版本**。引擎、规则数据和决策权重已随包提供，解压即可在本机 CPU 上运行，无需安装 npm 依赖、PyTorch 或配置 API 密钥。

下载并解压 [第五版独立包](https://github.com/1942ILSX/LegacyIntelligenceForStonghold/releases/download/stage-5/solo-lv20-stage-5.zip)，在含有 `play.mjs` 的目录执行：

```sh
node play.mjs --seed 1562147249 --band auto --threads 4
```

如果使用 Git 检出，在仓库根目录执行：

```sh
node stage-5/play.mjs --seed 1562147249 --band auto --threads 4
```

结果以 JSON Lines 输出，每行一局。`win` 是正式引擎判定的通关结果，`reached14` 表示已在第 14 回合就绪，`band` 是实际选择的策略，`actions` 统计正式执行的各类指令。固定种子可以重现开局；布阵搜索受实际时限约束，机器负载可能影响后续选择。

| 参数 | 用途 |
| --- | --- |
| `--band auto` | 由 AI 自主选策略，默认模式。 |
| `--band random` | 为每局均匀指派一个单人可用策略。 |
| `--band band_jesica` | 指定杰西卡，也可传其他合法策略 ID。 |
| `--seed N --count K` | 从种子 N 起连续运行 K 个开局。省略种子时随机选择起点。 |
| `--threads N` | 每局可用 1～4 个预演工作线程，验收配置为 4。 |
| `--trace --output games.jsonl` | 将逐步操作与结果写入新文件或空文件。 |

## 接入自己的引擎

`play.mjs` 已经接好了包内引擎。如果你手里另有一份 Stronghold-Protocol，希望用它来裁决正式对局，请使用 [play-with-engine.mjs](play-with-engine.mjs)。已验证的组合是上游 **v0.4.0**、规则 `act3autochess@V3_1`、单人 `mode_single_20`，以及 Node.js 24.22.3。[上游引擎版本](https://github.com/sganggs/Stronghold-Protocol/tree/v0.4.0)

在 **AI 仓库根目录**执行以下命令。如果已有 v0.4.0 引擎，可跳过第一行，直接将 `--engine` 指向引擎根目录。该目录下应直接包含 `package.json`、`server/match/Match.js` 和 `data/versions/act3autochess-v3_1/`。

```sh
git clone --depth 1 --branch v0.4.0 https://github.com/sganggs/Stronghold-Protocol.git ../Stronghold-Protocol
node play-with-engine.mjs --engine "../Stronghold-Protocol" --seed 1562147249 --band auto --threads 4 --trace --output engine-game.jsonl
```

Windows 绝对路径也可以写成 `--engine "D:/Games/Stronghold-Protocol"`。如果使用独立 ZIP，请从[发布页](https://github.com/1942ILSX/LegacyIntelligenceForStonghold/releases/tag/stage-5)另下载同名附件 `play-with-engine.mjs`，放在解压后的 `play.mjs` 旁边，再执行第二行。重复测试时请为 `--output` 换一个新文件名。

**确认接入成功。** 打开结果 JSONL，检查 `independent: true`、`human: true`、`autoplay: false` 和 `errors: 0`。`history` 记录购买、移动、就绪等指令及引擎回执。`parallelStats` 记录布阵预演，抵达第 14 回合的对局还可查看 `terminalGeometry`。上面的种子在上游 v0.4.0 实测完成了 14 次就绪，终局预演完成 4/4 个方案，正式结算为通关。

**调用链。** 启动器在本地进程中用外部引擎创建一场新的 `Match`，由服务器结算战斗。玩家占一个 `isBot: false` 的普通席位。在需要操作的阶段，运行器读取公共局面和本席位视图，交给 `player.decide(need, snapshot)`。普通指令送入 `match.handle(playerId, msg)`，布阵请求先经预演筛选，再拆成一系列 `g.move`。运行器将指令结果交给 `player.ack(status)`，在下一步重新读取局面。四个预演线程使用 AI 包内冻结的 v0.4.0 规则，正式胜负由 `--engine` 指定的引擎决定；修改外部战斗规则后，两边的预测可能出现偏差。[完整运行器入口](stage-5/players/win80-combat/road-and-boss-student-mux-referee.mjs) · [席位与阶段循环](stage-5/players/solo-40-portfolio-c/referee.mjs) · [移动指令执行](stage-5/players/solo-40-portfolio-c/formation.mjs)

此入口用于本地单人无界面对局。浏览器房间、已在运行的服务器和大厅内置 bot 菜单使用单独的接入接口。上游开发源码的可选 external-LLM 模块由启动器在本进程切换到发布版关闭状态，无需修改上游文件或设置 `SP_BOT_STRATEGY`。

## 玩家怎样决策

- **开局。** 读取公开的 Boss、地图、可选盟约与禁用项，选出合法策略，并绑定相应经营路线。
- **经营。** 用路线规则、商店升级节奏模型和阵容评分决定购买、合成准备、换人和装备。通用阵容网络是 `375 → 40 → 1`，部分专门路线采用自己的经营逻辑。
- **战斗。** 在独立的引擎副本中限时比较合法站位。第 14 回合的网络为 `311 → 48 → 24 → 3`，先从候选阵中选出最多三套，再与实际落地的原阵一起预演。主线程将所选方案转为普通玩家指令。正式对局全程由包内玩家控制，无需调用内置 legacy bot。

入口分别是[运行配置](stage-5/release.json)、[玩家控制器](stage-5/players/frozen-player.mjs)、[经营估值](stage-5/players/win80-economy/campaign/integration/market-policy.mjs)与[终局布阵排序](stage-5/players/win80-combat/formation-lab-ranker.mjs)。冻结包内部保留了晋级前的候选名称；对外版本以第五版归档和校验值为准。

## 实测成绩与范围

规则版本为 `act3autochess@V3_1`，模式为 `mode_single_20`。第五版在本机自然开局验收中的结果如下。

| 指标 | 结果 |
| --- | ---: |
| 整局通关 | 376 / 512（73.4%，95% Wilson 区间 69.4%～77.1%） |
| 进入第 14 回合 | 463 / 512（90.4%） |
| 进入第 14 回合后通关 | 376 / 463（81.2%） |
| 技术异常 | 2 局，均计入 512 局分母并按负处理 |
| 普通波 / Boss 布阵首条指令延迟 P99 | 402.9 / 475.4 毫秒 |

73.4% 衡量自主选策。矩兽是主要弱项，本批 61 个矩兽开局中有 51 局进入第 14 回合，21 局通关。第五版的全量随机指派与中途接盘面板截至本次发布尚未完成。详细分母、技术异常和延迟见[原始验收摘要](evaluation/stage-5.json)。

## 版本校验与署名

发布附件 `solo-lv20-stage-5.zip` 的 SHA-256：

```text
711aec1746ed69eacef6d5e55044a43a0fb901b4e0a223440887bd85165a4ed9
```

仓库的 `stage-5/` 与该 ZIP 解压后的内容一致。[包内清单](stage-5/manifest.json)记录了除清单自身之外全部 947 个文件的 SHA-256。

本项目是非官方同人研究项目，含游戏数据的发布包供学习、研究和个人非商业使用。《明日方舟》的名称、角色与游戏数据归相应权利人所有。仓库原有的 [MIT 许可证](LICENSE) 保留；随包引擎代码按上游 [GPL-3.0-or-later](stage-5/engine/v0.4.0/LICENSE) 发布。使用或再分发时请同时参阅[引擎版权与使用声明](stage-5/engine/v0.4.0/NOTICE.md)、[第三方声明](stage-5/engine/v0.4.0/THIRD-PARTY-NOTICES.md)和[阵容攻略数据署名](stage-5/players/win80/GUIDES-LICENSE.txt)。
