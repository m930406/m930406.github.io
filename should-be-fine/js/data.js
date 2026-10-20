'use strict';
/* 遊戲內容資料：關卡、工作單、各種小測驗題庫。
   時間單位一律是「遊戲分鐘」，0 = 09:00，540 = 18:00。 */

const TM = (h, m) => (h - 9) * 60 + m;
const DAY_END = TM(18, 0);
const LUNCH = { open: TM(12, 0), late: TM(13, 30) };
const DEPLOY = { open: TM(14, 0), close: TM(17, 30) };
const OT_END = TM(21, 0);   // 加班最晚到幾點（大樓關燈）

/* 下班時間：關卡的 stay（0～1）越高，大家留越晚。
   安娜永遠準時走：改需求的人不用加班。 */
const LEAVE = {
  pm: () => DAY_END - RND(0, 3),
  qa: stay => DAY_END + RND(0, Math.round(90 * stay)),
  rev: stay => DAY_END + RND(Math.round(30 * stay), Math.round(150 * stay)),
  boss: stay => DAY_END + RND(30 + Math.round(60 * stay), 30 + Math.round(150 * stay)),
  cw: stay => DAY_END + RND(-30, Math.round(180 * stay)),
};
const LEAVE_NOTE = {
  pm: '安娜準時下班了：「明天見～需求我再想想」',
  qa: '小芸下班了，之後只能自己測',
  rev: '阿凱下班了，之後沒人幫你 review',
  boss: '大衛下班了：「不要太晚喔～」',
};

/* 下班 on-call：0 = 20:00，720 = 隔天 08:00 */
const TN = (h, m) => ((h - 20 + 24) % 24) * 60 + m;
const NIGHT_END = TN(8, 0);
const ALARM = TN(7, 30);

/* ================= 時間成本表（遊戲分鐘） =================
   工程師的工作跟護理不一樣：走動很便宜，最貴的是被打斷和溝通。
   想調難度，改這裡就好。 */
const COST = {
  walk: { office: 0.5, home: 0.6 },  // 走路每秒過幾分鐘：辦公室橫越一趟約 2 分鐘
  codeBlock: 45,         // 一段專注寫 code 的時間
  ctxSwitch: 10,         // 寫到一半被打斷，回神要花的時間（從進度扣）
  reviewOwn: 15,         // 阿凱 review 你的 PR、討論修改
  reviewHelp: 20,        // 幫阿凱看 PR
  handoff: 5,            // 交測：寫測試說明給小芸
  qa: [40, 60],          // 小芸測一張單
  qaUrgent: [15, 20],    // 急件優先測
  selfTest: 25,          // 加班時小芸下班了，只能自己測
  bugFix: [20, 35],      // QA 退件後要修的量
  bounceTalk: 10,        // 跟小芸一起重現 bug
  deploy: 20,            // CI/CD 跑完、上線後盯一下監控
  standup: [15, 25],     // 站會（講得簡潔／講太久）
  pmTalk: { clear: 20, rushed: 10, negotiate: 10 },  // 跟 PM 談需求變更：問清楚比較久，但省返工
  urgentTalk: 10,        // 急件先對範圍
  bigTalk: 20,           // 明天就要的大單：談範圍
  changeAdd: [30, 55],   // 一次需求變更多出來的工作量
  status: 10,            // 跟主管報告進度
  report: 10,            // 跟主管回報事故
  alertFix: [25, 50],    // 白天處理告警（判斷對／繞遠路）
  alertAck: 15,          // 告警響了幾分鐘內要到機房
  coffee: 5, lunch: 30, wc: 5,
  // on-call
  pageFix: [30, 60],     // 半夜救火（判斷對／繞遠路）
  fakeFix: [10, 30],     // 假警報：調閾值、開單
  incUpdate: 5,          // 寫事故頻道更新
  lineReply: 3, lineCode: 60,   // 回 LINE／半夜爬起來改需求
  pickup: 2, dinner: 20, shower: 15, sofa: 20,
  fallAsleep: 10, fallAsleepWoke: 10,  // 入睡要多久；每被叫醒一次再多 10 分鐘睡不著（最多 50）
};

/* 每個關卡都有同一份「正常負載」：3 張一般單、站會、幫忙 review 一次、告警一次、主管問進度一次。
   關卡的差別只疊在上面：需求變更的頻率、急件、明天就要的大單。 */
/* 關卡依需求的變化方式排列：越後面越兇、越難協商、返工越多。 */
const LEVELS = {
  freeze: {
    stay: 0.2,
    weekend: { pages: 2, desc: '系統很穩，24 小時裡大概只會被 page 2 次。' },
    key: 'freeze', name: '需求凍結期', freq: '需求凍結，今天不會改',
    desc: '規格大致定案，終於可以專心寫 code。很少人來吵你，適合先熟悉整個流程。',
    tickets: 3, changeAt: [], changeEvery: null, changeDl: 35,
    rework: 0.2, negotiate: 0.7, from: '客戶最後確認時發現',
    night: { pages: 2, line: 0, desc: '系統很穩，一晚大約 2 次 page，其中一次可能是假警報。' },
    events: [
      { t: TM(9, 30), ping: ['meet', 'standup', 15] },
      { t: TM(10, 40), ping: ['rev', 'helpReview', 40] },
      { t: TM(11, 15), alert: true },
      { t: TM(13, 50), ping: ['boss', 'status', 40] },
    ],
  },
  sprint: {
    stay: 0.4,
    weekend: { pages: 3, desc: '24 小時裡大概會被 page 3 次。' },
    key: 'sprint', name: '敏捷迭代', freq: '需求一天改 1 次',
    desc: 'Sprint 進行到一半，PM 今天會帶著一個「小調整」過來。先問清楚再動手，能協商就協商。',
    tickets: 3, changeAt: [], changeEvery: null, changeRand: [TM(10, 30), TM(15, 0)], changeDl: 30,
    rework: 0.35, negotiate: 0.45, from: 'Sprint 中間 PM 回報',
    night: { pages: 3, line: 1, desc: '一晚大約 3 次 page。PM 也可能半夜傳 LINE。' },
    events: [
      { t: TM(9, 30), ping: ['meet', 'standup', 15] },
      { t: TM(10, 50), ping: ['rev', 'helpReview', 40] },
      { t: TM(12, 40), alert: true },
      { t: TM(13, 50), ping: ['boss', 'status', 40] },
    ],
  },
  chaos: {
    stay: 0.6,
    weekend: { pages: 4, desc: '平日改太多、趕著上線，24 小時裡大概會被 page 4 次。' },
    key: 'chaos', name: '朝令夕改', freq: '需求一天改好幾次（約每 2 小時）',
    desc: '老闆在電梯裡、在午餐時、在洗手時都會想到新點子。需求一直變，能守住幾張單上線就是勝利。',
    tickets: 3, changeAt: [], changeEvery: [100, 140], firstChange: TM(10, 0), changeDl: 25,
    rework: 0.4, negotiate: 0.15, from: '老闆在電梯裡想到',
    night: { pages: 5, line: 2, desc: '白天改太多、趕著上線，晚上大約 5 次 page，老闆還會半夜傳 LINE 改需求。' },
    events: [
      { t: TM(9, 30), ping: ['meet', 'standup', 15] },
      { t: TM(11, 0), ping: ['boss', 'status', 40] },
      { t: TM(11, 50), alert: true },
      { t: TM(13, 10), ping: ['rev', 'helpReview', 40] },
      { t: TM(14, 30), ping: ['boss', 'status', 40] },  // 朝令夕改：老闆多問一次進度
    ],
  },
  urgent: {
    stay: 0.8,
    weekend: { pages: 4, desc: '急著上的東西週末最容易出事，24 小時裡大概會被 page 4 次。' },
    key: 'urgent', name: '急件馬上要', freq: '急件隨時插進來，2 小時內要上線',
    desc: '業務在客戶那邊先答應了。急件一張一張插進來，手上的單只能往後排。先問清楚「馬上要」到底要到什麼程度。',
    tickets: 3, changeAt: [], changeEvery: null, changeDl: 30,
    rework: 0.3, negotiate: 0.3, from: '業務在客戶那邊答應了',
    urgent: { first: TM(10, 0), every: [80, 110], last: TM(15, 30), due: 120 },
    night: { pages: 3, line: 2, desc: '白天急著上的東西，晚上比較容易出事。一晚大約 3 次 page，業務還會半夜問急件。',
      msgs: [{ who: '業務 Leo', text: '那個急件今晚可以先上嗎？客戶在等 🙏' }, { who: 'PM 安娜', text: '客戶說明天一早還要再加一個欄位，可以嗎？' }] },
    events: [
      { t: TM(9, 30), ping: ['meet', 'standup', 15] },
      { t: TM(11, 40), ping: ['rev', 'helpReview', 40] },
      { t: TM(13, 0), alert: true },
      { t: TM(14, 10), ping: ['boss', 'status', 40] },
    ],
  },
  tomorrow: {
    stay: 0.9,
    weekend: { pages: 3, desc: '24 小時裡大概會被 page 3 次，老闆還惦記著 demo。' },
    key: 'tomorrow', name: '明天就要', freq: '下午才來的大需求，明天一早就要',
    desc: '下午兩點半，老闆說明天早上 demo 要用。做不完就只能加班。先跟 PM 把範圍砍到 demo 真的需要的部分。',
    tickets: 3, changeAt: [], changeEvery: null, changeDl: 30,
    rework: 0.3, negotiate: 0.5, from: '老闆看完週報後決定',
    big: { at: TM(14, 30), dl: 20, cut: 0.6 },
    night: { pages: 2, line: 2, desc: '一晚大約 2 次 page。老闆會半夜追問明天 demo 的進度。',
      msgs: [{ who: '老闆', text: '明天 demo 的東西好了嗎？可以先傳截圖給我看嗎' }, { who: '老闆', text: '我想了一下，demo 開場可以加個動畫嗎？' }] },
    events: [
      { t: TM(9, 30), ping: ['meet', 'standup', 15] },
      { t: TM(10, 40), ping: ['rev', 'helpReview', 40] },
      { t: TM(12, 50), alert: true },
      { t: TM(16, 0), ping: ['boss', 'status', 40] },
    ],
  },
};

/* 急件：插單進來，要在時限內上線 */
const URGENT_POOL = [
  { title: '結帳按鈕在 iPhone 上點不到', est: 45 },
  { title: '活動頁價格顯示錯誤', est: 40 },
  { title: '大客戶要的報表欄位今天要看到', est: 50 },
  { title: '登入驗證碼收不到', est: 45 },
  { title: '客戶 demo 前先關掉推薦功能', est: 35 },
];
const URGENT_ITEMS = [
  { t: '「馬上要」是要做到什麼程度：最小能用的範圍', ok: true },
  { t: '手上哪張單要往後延，跟 PM 講清楚', ok: true },
  { t: '做完要怎麼驗證、誰來確認', ok: true },
  { t: '全部丟下，先做再說', ok: false },
  { t: '三件事同時做，每件都說好', ok: false },
  { t: '跟 PM 說「應該沒問題」', ok: false },
];

/* 明天就要：下午才來的大需求 */
const BIG_POOL = [
  { title: '明天 demo 的新版儀表板', est: 160 },
  { title: '投資人簡報要用的數據頁', est: 150 },
  { title: '明天客戶會議要看的新流程', est: 155 },
];
const BIG_ITEMS = [
  { t: '列出明天 demo 一定要有的部分', ok: true },
  { t: '其他的排到 demo 之後', ok: true },
  { t: '約好今天幾點前回報進度', ok: true },
  { t: '全部都做，大不了通宵', ok: false },
  { t: '直接拒絕，說做不到', ok: false },
  { t: '先說「應該沒問題」再說', ok: false },
];

/* 工作單題庫：est = 預估要寫幾分鐘；changes = PM 可能提出的變更。 */
const TICKET_POOL = [
  { title: '登入頁加「記住我」', est: 60, changes: ['「記住我」改成 30 天，還要能在設定頁一鍵登出所有裝置', '順便加 Google 登入，老闆說很簡單'] },
  { title: '訂單列表加篩選', est: 80, changes: ['篩選條件要能存成「我的常用篩選」', '日期篩選改成選區間，不是只選一天'] },
  { title: '報表匯出 CSV', est: 55, changes: ['除了 CSV 也要能匯出 Excel', '欄位順序要照財務那張表，最後還要加總列'] },
  { title: '修購物車數量 bug', est: 45, changes: ['順便把數量上限改成 99，超過要跳提示', '數量改成可以直接打字，不只按加減'] },
  { title: '會員等級徽章', est: 60, changes: ['徽章要有動畫，行銷說比較有感', '等級從 3 級改成 5 級'] },
  { title: '推播通知開關', est: 65, changes: ['開關要拆成行銷、訂單、系統三種', '晚上 10 點以後不要推播'] },
  { title: '首頁 banner 輪播', est: 50, changes: ['banner 要依會員等級顯示不同內容', '改成可以放影片'] },
  { title: '結帳加優惠碼', est: 80, changes: ['優惠碼要能跟點數折抵一起用', '一張訂單可以用兩組優惠碼'] },
  { title: '商品頁加評價星等', est: 55, changes: ['評價要能附照片', '只有買過的人才能評價'] },
];

const EXTRA_POOL = [
  { title: '活動頁倒數計時', est: 50 },
  { title: '後台加「一鍵停售」', est: 55 },
  { title: '客服表單加附件上傳', est: 60 },
  { title: '分享按鈕加 LINE', est: 40 },
];

/* Code review：找出程式碼裡的問題。a = 正確選項的索引。 */
const REVIEW = [
  {
    code: 'function sumPrices(items) {\n  let total = 0;\n  for (let i = 0; i <= items.length; i++) {\n    total += items[i].price;\n  }\n  return total;\n}',
    opts: ['迴圈多跑一圈，最後讀到 items[items.length] 會噴錯', 'total 應該用 const 宣告', '應該改用 while 迴圈', '沒問題，LGTM'],
    a: 0, why: 'i <= items.length 會多跑一次，讀 undefined.price 直接 TypeError。條件要用 <。',
  },
  {
    code: 'app.get("/user", async (req, res) => {\n  const sql = "SELECT * FROM users WHERE id = " + req.query.id;\n  res.json(await db.query(sql));\n});',
    opts: ['使用者輸入直接接進 SQL，會被 SQL injection', '應該用 POST 不是 GET', 'SELECT * 要改成列出欄位才會正確', '沒問題，LGTM'],
    a: 0, why: '要用參數化查詢：db.query("... WHERE id = ?", [id])。SELECT * 頂多是效能小事，注入是資安大事。',
  },
  {
    code: 'async function canDelete(userId) {\n  const user = getUser(userId); // getUser 是 async\n  return user.role === "admin";\n}',
    opts: ['getUser 沒有 await，user 是 Promise，結果永遠是 false', 'role 應該用 == 比較', '函式名稱應該叫 isAdmin', '沒問題，LGTM'],
    a: 0, why: 'Promise 物件沒有 role 屬性，所以連管理員都刪不了東西。要寫 await getUser(userId)。',
  },
  {
    code: 'const stripe = new Stripe("sk_live_51Hx...9aQ");\n\nexport function charge(amount) {\n  return stripe.charges.create({ amount });\n}',
    opts: ['正式環境的金鑰直接寫在程式碼裡，commit 之後就外流了', '應該用 let 宣告', 'charge 少了 async', '沒問題，LGTM'],
    a: 0, why: '金鑰要放環境變數或 secret manager。已經 commit 上去的要立刻撤銷、換一把新的。',
  },
  {
    code: 'try {\n  await saveOrder(order);\n} catch (e) {}\nshowToast("訂單已送出");',
    opts: ['錯誤被吞掉，存檔失敗也會顯示「已送出」', 'try 區塊太短了', 'showToast 要放在 try 前面', '沒問題，LGTM'],
    a: 0, why: '空的 catch 會讓失敗變成無聲無息。至少要記錄錯誤，並讓使用者知道沒有成功。',
  },
  {
    code: 'const orders = await db.orders.findAll();\nfor (const o of orders) {\n  o.user = await db.users.findById(o.userId);\n}',
    opts: ['每筆訂單都查一次資料庫（N+1），訂單一多就超慢', 'for...of 裡面不能用 await', 'findAll 一定要加 limit 才會正確', '沒問題，LGTM'],
    a: 0, why: '把所有 userId 收集起來一次查（IN 查詢）或用 join，查詢次數從 N+1 變 2。',
  },
  {
    code: 'if (user.status = "banned") {\n  return res.status(403).end();\n}\nnext();',
    opts: ['= 是指派不是比較，所有人都會被擋下來', '403 應該改成 401', '字串應該用單引號', '沒問題，LGTM'],
    a: 0, why: 'user.status = "banned" 會把每個人都設成 banned，而且條件永遠成立。要用 ===。',
  },
  {
    code: 'const total = 0.1 + 0.2; // 單位：元\nif (total === 0.3) {\n  applyCoupon();\n}',
    opts: ['浮點數有誤差，0.1 + 0.2 不等於 0.3；金額要用整數（分）算', '=== 改成 == 就好', 'applyCoupon 要傳參數', '沒問題，LGTM'],
    a: 0, why: '0.1 + 0.2 = 0.30000000000000004。錢一律換成最小單位的整數來算。',
  },
];

/* 線上告警：看監控資料，決定第一步。afterDeploy = 部署後才會出現的那種。 */
const INCIDENTS = [
  {
    title: '5xx 錯誤率暴衝', afterDeploy: true,
    data: ['剛剛部署了新版本', '5xx 錯誤率 0.2% → 31%', 'TypeError: Cannot read properties of undefined (reading "price")'],
    opts: ['先回滾到上一版止血，再查原因', '直接在正式環境改 code 熱修', '把所有伺服器重開', '先開會釐清是誰的錯'],
    a: 0, why: '剛部署就壞，最快恢復服務的方法是回滾。止血之後再慢慢找原因。',
  },
  {
    title: '硬碟快滿了',
    data: ['/var/log 使用率 98%', 'app.log 單一檔案 41 GB', '服務開始寫不進檔案'],
    opts: ['清掉舊 log 騰出空間，再設定 log rotation', '把機器關掉', '加開十台新機器', '把錯誤訊息隱藏起來'],
    a: 0, why: '先騰空間讓服務恢復，再設定 log rotation 讓它不會再發生。',
  },
  {
    title: '資料庫連線塞爆',
    data: ['DB 連線數 200 / 200', 'API 回應時間 200ms → 12s', '慢查詢：報表 SQL 已經跑了 48 分鐘'],
    opts: ['找出卡住的慢查詢先終止，再把報表移到唯讀副本', '把連線上限調到 5000', '直接重開資料庫', '請使用者先不要用'],
    a: 0, why: '元兇是那支報表查詢。先終止它，長期把重查詢移到唯讀副本。亂調連線上限只會把 DB 壓垮。',
  },
  {
    title: '記憶體一直漲',
    data: ['記憶體每小時漲 300 MB', '每 6 小時被 OOM kill 一次', '最近的改動：加了一個沒有過期機制的快取 Map'],
    opts: ['先重啟止血並抓 heap 快照，再替快取加上限和過期', '把機器記憶體加到 4 倍就好', '把告警關掉', '把快取改成全域變數'],
    a: 0, why: '典型的記憶體洩漏。重啟只能止血，根本解是讓快取有上限、會過期。',
  },
  {
    title: 'SSL 憑證過期',
    data: ['瀏覽器顯示「你的連線不是私人連線」', '憑證到期日：今天 00:00', '自動續約排程上個月被停用'],
    opts: ['立刻續約更新憑證，並把自動續約修好', '請使用者按「繼續前往」', '先改回 http', '等明天再處理'],
    a: 0, why: '先換上新憑證恢復服務，再把自動續約修好，不然下次還會再發生。',
  },
  {
    title: '金流 API 逾時',
    data: ['金流 API 逾時率 60%', '金流商狀態頁：部分服務中斷', '結帳頁一直轉圈圈'],
    opts: ['開降級：結帳頁顯示暫停付款公告，並聯絡金流商', '自己寫一套金流系統', '把逾時時間調到 10 分鐘', '讓前端無限重試直到成功'],
    a: 0, why: '問題在外部，你修不了它。能做的是優雅降級、告知使用者，並追蹤廠商進度。無限重試只會雪上加霜。',
  },
];

/* 向主管回報事故時該講的內容（複選）。 */
const REPORT_ITEMS = [
  { t: '影響範圍：多少使用者、哪些功能', ok: true },
  { t: '開始時間跟目前狀態（止血了沒）', ok: true },
  { t: '做了什麼處理、下一步跟預計時間', ok: true },
  { t: '這是誰害的', ok: false },
  { t: '把整段 log 原封不動貼給主管', ok: false },
  { t: '「應該沒問題了」，其他不多說', ok: false },
];

/* 需求變更時，動手前該先跟 PM 確認的事（複選）。 */
const CLARIFY_ITEMS = [
  { t: '驗收條件：做到什麼程度算完成', ok: true },
  { t: '會影響到哪些已經做好的部分', ok: true },
  { t: '上線日期要不要跟著調整', ok: true },
  { t: '不用問了，直接答應今天一起上', ok: false },
  { t: '問她為什麼又改，順便抱怨三分鐘', ok: false },
  { t: '先說「應該沒問題」，回去再說', ok: false },
];

const BUG_TEXTS = [
  '在 Safari 上按鈕點了沒反應',
  '輸入 0 的時候畫面整個白掉',
  '切換成英文之後版面跑掉',
  '網路慢的時候連點兩下會送出兩次',
  '資料超過 100 筆就不顯示了',
];

const QA_REPLY = {
  opts: ['照小芸的步驟先重現，補一個測試再修', '「在我電腦上是好的」', '請小芸清快取再測一次', '直接把 issue 關掉'],
  a: 0, why: '先重現才知道真正的原因，補上測試，同一個 bug 就不會再回來。',
};

const STANDUP = {
  opts: ['「今天先把 #1 寫完交 review，下午交測；目前沒有卡關」', '花 15 分鐘講昨天踩到的坑', '「跟昨天一樣」', '「有寫在群組了」，然後滑手機'],
  a: 0, why: '站會講三件事就好：昨天做了什麼、今天要做什麼、有沒有卡關。細節會後再聊。',
};

const DEPLOY_SAY = {
  opts: ['「部署中，有狀況我會在這裡即時更新」', '「應該沒問題啦」', '什麼都不說，默默按下去'],
};

/* ================= 下班 on-call ================= */

/* 半夜的告警。fake = 假警報（正確做法是確認沒影響、調整告警，明天再處理） */
const NIGHT_INCIDENTS = [
  {
    title: '每日對帳排程失敗',
    data: ['02:00 每日對帳排程失敗', '錯誤：上游檔案還沒產生（延遲 40 分鐘）', '早上 9 點財務要用這份報表'],
    opts: ['等上游檔案到了手動重跑排程，並在頻道記錄', '把排程刪掉，明天再說', '請財務明天自己手算', '寫個迴圈重跑 50 次直到成功'],
    a: 0, why: '原因很清楚（上游延遲），補跑一次就好。記錄下來，明天再追為什麼上游會晚。',
  },
  {
    title: '流量暴增',
    data: ['行銷排程在 23:00 推播了全站優惠', '流量是平常的 8 倍', 'CPU 95%，開始出現逾時'],
    opts: ['先擴充機器扛住流量，再檢查自動擴展的設定', '把推播收回來', '先把網站關掉', '等它自己退燒'],
    a: 0, why: '這是「好的」流量，先擴充撐住。自動擴展為什麼沒有自己長出來，明天檢討。',
  },
  {
    title: '登入服務 502',
    data: ['登入 API 502 錯誤率 40%', '其中一台主機健康檢查失敗', '另外兩台正常'],
    opts: ['先把壞掉的那台從負載平衡移出，再開新機器補上', '把三台全部重開', '關掉健康檢查', '請使用者稍後再試'],
    a: 0, why: '只有一台壞，先把它隔離，流量就會回到健康的機器上。全部重開反而會讓服務整個中斷。',
  },
];
const FALSE_ALARM = {
  title: 'CPU 使用率告警', fake: true,
  data: ['告警：CPU 使用率 > 70%', '回應時間正常、錯誤率 0%', '這個告警這週已經響了 6 次'],
  opts: ['確認使用者沒受影響，調高閾值並開單，明天檢討告警', '保險起見把所有伺服器重開', '把監控整個關掉，好好睡', '打電話把主管叫醒'],
  a: 0, why: '沒影響使用者的告警就是雜訊。響太多次大家會麻痺，真的出事反而沒人理。調整它、開單，明天再好好處理。',
};

const LINE_MSGS = [
  { who: '老闆', text: '那個按鈕可以改成綠色嗎？明天早上要 demo 🙏' },
  { who: 'PM 安娜', text: '欸我剛想到，匯出的檔名可以加日期嗎？不急不急～' },
  { who: '老闆', text: '首頁感覺太空了，可以加個輪播嗎？明天給客戶看' },
];
const LINE_REPLY = {
  opts: ['「收到，明天上班處理。真的很急請打 on-call 電話」', '爬起來開電腦改', '已讀不回', '回「好，馬上改」，然後繼續睡'],
  pts: [4, -4, -1, -4],
  why: 'on-call 是處理線上事故，不是半夜改需求。把界線講清楚，明天才有精神。',
};

/* ================= 晚上：家人和同事 ================= */
const FAMILY = { start: 6, max: 10 };   // 家人 ❤，從 6 開始

/* 半夜的訊息。opts/pts/fam/busy 一一對應：選項、分數、家人 ❤、要花幾分鐘 */
const NIGHT_MSGS = {
  mom: {
    t: TN(21, 10), who: '媽媽', text: '吃飽沒？最近是不是很忙？週末要不要回來吃飯',
    opts: ['打電話回去聊一下', '回「吃飽了，週末回去！」', '已讀，晚點再回'],
    pts: [0, 0, 0], fam: [2, 1, -1], busy: [10, 2, 0],
    why: '工作再忙，回家人一句話只要幾秒鐘。',
  },
  mike: {
    t: TN(23, 30), who: '海外同事 Mike', text: 'Hey, are you around? Quick question about the payment API 🙏',
    opts: ['「我在 on-call，非緊急的請開 ticket，明天回你」', '爬起來幫他查', '已讀不回'],
    pts: [3, -3, -1], fam: [0, -1, 0], busy: [2, 30, 0],
    why: 'on-call 處理的是線上事故，不是時差同事的問題。給他明確的下一步，雙方都好過。',
  },
  boss: {
    who: '主管 大衛', text: '看到事故頻道了，辛苦了。明天早上 9 點開個檢討會喔',
    opts: ['「好，我會先整理時間軸」', '「昨晚被叫起來好幾次，可以改到下午嗎？」', '已讀'],
    pts: [1, 2, -1], fam: [0, 0, 0], busy: [2, 2, 0],
    why: '被叫起來好幾次還要一早開會，講出來不丟臉。檢討會的目的是改善，不是比誰撐得久。',
  },
};
/* 早上交接給白天的 on-call（複選） */
const HANDOFF_ITEMS = [
  { t: '昨晚發生了哪些事故、處理到哪裡', ok: true },
  { t: '還沒結束、要繼續追的事（例如根本原因）', ok: true },
  { t: '哪些告警是雜訊、需要調整', ok: true },
  { t: '只說「都處理好了」', ok: false },
  { t: '什麼都不寫，反正有事故頻道', ok: false },
  { t: '抱怨昨晚有多累', ok: false },
];

/* ================= 假日值班（週六 00:00–24:00，在家） ================= */
const TW = (h, m) => h * 60 + m;   // 0 = 週六 00:00
const WEEKEND_END = TW(24, 0);
const WEEKEND_WAKE = TW(8, 30);   // 週末沒鬧鐘，睡到自然醒
/* 小雯的週末計畫：mins = 出門多久、fam = 順利完成加多少 ❤ */
const WEEKEND_PLANS = [
  { t: TW(10, 30), key: 'brunch', label: '出門吃早午餐', ask: '「天氣很好，要不要去吃早午餐？」', mins: 90, fam: 2, meal: true },
  { t: TW(14, 0), key: 'movie', label: '去看電影', ask: '「下午那部電影要不要去看？兩個小時。」', mins: 120, fam: 2, movie: true },
  { t: TW(17, 30), key: 'parents', label: '回爸媽家吃晚飯', ask: '「媽說今天晚上回去吃飯，你可以嗎？」', mins: 150, fam: 3, meal: true },
];
const WEEKEND_MSGS = {
  boss: {
    t: TW(11, 20), who: '主管 大衛', text: '週末打擾一下，週一早上要的報表，可以先弄一下嗎？',
    opts: ['「週一早上第一件事處理」', '週末打開電腦弄', '已讀'],
    pts: [3, -3, -1], fam: [0, -1, 0], busy: [2, 60, 0],
    why: '值班是處理線上事故，不是週末加班。週一的事，週一做。',
  },
  pm: {
    t: TW(15, 40), who: 'PM 安娜', text: '不急！週一再看就好～（附件：新需求 v4，共 12 頁）',
    opts: ['週一再看', '忍不住點開，越看越氣', '已讀'],
    pts: [2, -2, 0], fam: [0, -1, 0], busy: [0, 20, 0],
    why: '說不急的，就讓它週一再急。',
  },
};
