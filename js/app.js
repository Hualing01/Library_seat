/* ==========================================================================
   图书馆阅览座位预约系统 · 高保真原型交互脚本
   Seat Reservation Prototype
   纯原生 JS，无任何外部依赖，可离线运行
   ========================================================================== */
(function () {
  'use strict';

  /* ============================== 基础常量 ============================== */
  var OPEN_MIN = 8 * 60;
  var CLOSE_MIN = 22 * 60;
  var FLOORS = [1, 2, 3];
  var SEATS_PER_ROOM = 12;

  var rooms = [
    { id: 'A', name: 'A区阅览室', zone: '自习区', floorDesc: '馆藏中文图书借阅区' },
    { id: 'B', name: 'B区阅览室', zone: '自习区', floorDesc: '现刊阅览区' },
    { id: 'C', name: 'C区自习室', zone: '自习区', floorDesc: '静音自习室' },
    { id: 'D', name: 'D区电源区', zone: '电源区', floorDesc: '带独立电源插座' }
  ];

  var SEAT_STATUS = {
    free: { label: '空闲', cls: 'seat--free', dot: '#10b981' },
    booked: { label: '已预约', cls: 'seat--booked', dot: '#f59e0b' },
    using: { label: '使用中', cls: 'seat--using', dot: '#ef4444' },
    locked: { label: '违规锁定', cls: 'seat--locked', dot: '#94a3b8' }
  };

  var BADGE = {
    '待签到': 'badge--warn', '使用中': 'badge--info', '已完成': 'badge--muted',
    '已取消': 'badge--muted', '违约': 'badge--danger', '已签到': 'badge--ok',
    '空闲': 'badge--ok', '已预约': 'badge--warn', '申诉中': 'badge--warn',
    '已处理': 'badge--muted', '已撤销': 'badge--ok', '已驳回': 'badge--danger',
    '生效中': 'badge--danger', '已解除': 'badge--muted', '违规锁定': 'badge--muted'
  };

  var PAGE_META = {
    'login': '1. 登录页',
    'student-home': '2. 学生端首页',
    'seat-detail': '3. 座位详情',
    'booking-success': '4. 预约成功',
    'checkin': '5. 扫码签到',
    'my-reservation': '6. 我的预约',
    'history-list': '7. 预约历史',
    'violation-list': '8. 违约记录',
    'appeal-submit': '9. 提交申诉',
    'message-list': '10. 消息通知',
    'profile': '11. 个人中心',
    'admin-home': '12. 管理端 · 数据概览',
    'admin-seat': '13. 管理端 · 座位维护',
    'admin-floorplan': '14. 管理端 · 座位平面图',
    'admin-reservation': '15. 管理端 · 全量预约',
    'admin-appeal': '16. 管理端 · 违约申诉',
    'admin-blacklist': '17. 管理端 · 黑名单管理',
    'admin-stats': '18. 管理端 · 统计报表'
  };

  var ADMIN_TITLES = {
    'admin-home': ['数据概览', '首页 / 数据概览'],
    'admin-seat': ['座位与阅览室维护', '座位资源 / 座位与阅览室维护'],
    'admin-floorplan': ['座位分布平面图', '座位资源 / 座位分布平面图'],
    'admin-reservation': ['全量预约数据', '预约与合规 / 全量预约数据'],
    'admin-appeal': ['违约申诉处理', '预约与合规 / 违约申诉处理'],
    'admin-blacklist': ['黑名单管理', '预约与合规 / 黑名单管理'],
    'admin-stats': ['统计报表', '数据分析 / 统计报表']
  };

  /* ============================== 时间工具 ============================== */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(m) { return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
  function toMin(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function md(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function shift(base, n) { var d = new Date(base); d.setDate(d.getDate() + n); return d; }
  var NOW = new Date();
  var T = {
    today: md(NOW), y1: md(shift(NOW, -1)), y3: md(shift(NOW, -3)),
    y4: md(shift(NOW, -4)), y9: md(shift(NOW, -9)), t1: md(shift(NOW, 1)),
    isoToday: iso(NOW), isoY1: iso(shift(NOW, -1))
  };

  /* ============================== 座位数据 ============================== */
  function seedStatus(fi, ri, n) {
    var h = (fi * 37 + ri * 23 + n * 13) % 10;
    if (h < 4) return 'free';
    if (h < 5) return 'free';
    if (h < 8) return 'booked';
    return 'using';
  }

  var seats = [];
  var seatMap = {};

  function buildSeats() {
    seats = []; seatMap = {};
    FLOORS.forEach(function (fl, fi) {
      rooms.forEach(function (rm, ri) {
        for (var n = 1; n <= SEATS_PER_ROOM; n++) {
          var id = rm.id + fl + '-' + pad2(n);
          var s = {
            id: id, roomId: rm.id, roomName: rm.name, zone: rm.zone, floor: fl, num: n,
            status: seedStatus(fi, ri, n), owner: null
          };
          seats.push(s); seatMap[id] = s;
        }
      });
    });
  }
  buildSeats();

  /* ============================== 应用状态 ============================== */
  var R = [
    { id: 'R2026091801', seatId: 'A2-05', seatName: 'A区阅览室 2F 05号', room: 'A区阅览室', zone: '自习区',
      date: T.today, iso: T.isoToday, start: '14:00', end: '16:00', status: '待签到', created: '今天 09:24',
      signWindow: '13:30 - 14:30' },
    { id: 'R2026091702', seatId: 'B1-08', seatName: 'B区阅览室 1F 08号', room: 'B区阅览室', zone: '自习区',
      date: T.y1, iso: T.isoY1, start: '09:00', end: '12:00', status: '已完成', created: T.y1 + ' 08:31',
      signWindow: '08:30 - 09:30', signAt: T.y1 + ' 08:52', releaseAt: T.y1 + ' 11:55' },
    { id: 'R2026091503', seatId: 'C3-02', seatName: 'C区自习室 3F 02号', room: 'C区自习室', zone: '自习区',
      date: T.y3, iso: iso(shift(NOW, -3)), start: '18:00', end: '20:00', status: '违约', created: T.y3 + ' 17:40',
      signWindow: '17:30 - 18:30' },
    { id: 'R2026091404', seatId: 'D2-07', seatName: 'D区电源区 2F 07号', room: 'D区电源区', zone: '电源区',
      date: T.y4, iso: iso(shift(NOW, -4)), start: '13:00', end: '16:00', status: '已取消', created: T.y4 + ' 12:10',
      signWindow: '12:30 - 13:30' },
    { id: 'R2026090905', seatId: 'B2-03', seatName: 'B区阅览室 2F 03号', room: 'B区阅览室', zone: '自习区',
      date: T.y9, iso: iso(shift(NOW, -9)), start: '19:00', end: '22:00', status: '已完成', created: T.y9 + ' 18:20',
      signWindow: '18:30 - 19:30', signAt: T.y9 + ' 18:47', releaseAt: T.y9 + ' 21:30' }
  ];

  var V = [
    { id: 'V2026091501', resId: 'R2026091503', reason: '超时未签到', seat: 'C区自习室 3F 02号',
      time: T.y3 + ' 18:00-20:00', status: '申诉中', note: '因宿舍网络故障，小程序一直提示签到失败', appealTo: '2026091501' },
    { id: 'V2026090902', resId: 'R2026090905', reason: '超时未签到', seat: 'B区阅览室 1F 08号',
      time: T.y9 + ' 09:00-11:00', status: '已驳回', note: '临时有事无法到馆，忘记取消预约' }
  ];

  var MSG = [
    { id: 'M1', type: 'remind', title: '预约即将开始', time: '5 分钟前', unread: true,
      text: '你预约的 A区阅览室 2F 05号 将于 14:00 开始，请提前到馆，并在 13:30—14:30 内扫码签到。' },
    { id: 'M2', type: 'system', title: '系统通知', time: '1 小时前', unread: true,
      text: '图书馆今晚 22:00 闭馆，请合理安排学习时间，离开时请记得释放座位。' },
    { id: 'M3', type: 'violation', title: '违约记录提醒', time: '3 天前', unread: false,
      text: '你有一条约 18:00 的预约超时未签到，已记 1 次违约。如因特殊原因未能签到，可在违约记录中提交申诉。' },
    { id: 'M4', type: 'system', title: '预约已取消', time: '4 天前', unread: false,
      text: '你已取消 D区电源区 2F 07号 13:00—16:00 的预约，座位已释放，本次取消不计入违约。' }
  ];

  var APPEALS = [
    { id: 'AP2026091501', name: '李四', sno: '2024010102', reason: '超时未签到', seat: 'C区自习室 3F 02号',
      time: T.y3 + ' 18:00-20:00', note: '当天下午临时被安排参加学院会议，赶到图书馆时已经超过签到窗口 12 分钟，并非故意占座。',
      status: '申诉中', submitted: T.y3 + ' 21:10', violations: 2 },
    { id: 'AP2026091602', name: '赵六', sno: '2024010104', reason: '超时未签到', seat: 'A区阅览室 1F 03号',
      time: T.y1 + ' 10:00-12:00', note: '座位二维码被前一位同学的书挡住，反复扫描都无法识别，直到 20 分钟后才签到成功。',
      status: '申诉中', submitted: T.y1 + ' 12:35', violations: 1 },
    { id: 'AP2026091203', name: '王五', sno: '2024010103', reason: '超时未签到', seat: 'B区阅览室 3F 06号',
      time: T.y4 + ' 15:00-17:00', note: '因病请假未到校，忘记取消预约。', status: '已驳回',
      submitted: T.y4 + ' 18:00', handledAt: T.y4 + ' 19:20', handler: '李老师', opinion: '未提供有效证明材料，维持违约记录。', violations: 3 },
    { id: 'AP2026091004', name: '孙七', sno: '2024010105', reason: '超时未签到', seat: 'D区电源区 2F 04号',
      time: T.y9 + ' 08:00-10:00', note: '当天暴雨导致公交大面积延误，到馆时已超时。', status: '已撤销',
      submitted: T.y9 + ' 10:30', handledAt: T.y9 + ' 14:05', handler: '李老师', opinion: '情况属实，已核实当日天气预警记录，撤销本次违约。', violations: 1 }
  ];

  var BLACKLIST = [
    { id: 'B2026091201', name: '王五', sno: '2024010103', college: '土木工程学院', violations: 3,
      since: T.y4, until: md(shift(NOW, 3)), status: '生效中', reason: '累计违约 3 次，系统自动加入黑名单' },
    { id: 'B2026082802', name: '周八', sno: '2024010206', college: '外国语学院', violations: 3,
      since: md(shift(NOW, -22)), until: md(shift(NOW, -15)), status: '已解除', reason: '黑名单期满自动解除' },
    { id: 'B2026081503', name: '吴九', sno: '2023010311', college: '信息工程学院', violations: 4,
      since: md(shift(NOW, -35)), until: md(shift(NOW, -28)), status: '已解除', reason: '学生提交有效证明材料，管理员人工解除' }
  ];

  var ADMIN_RES = [
    { id: 'AR001', name: '张三', sno: '2024010101', room: 'A区阅览室', seat: 'A区阅览室 2F 05号', date: T.today, iso: T.isoToday, time: '14:00-16:00', status: '待签到', created: '09:24' },
    { id: 'AR002', name: '李四', sno: '2024010102', room: 'B区阅览室', seat: 'B区阅览室 1F 08号', date: T.today, iso: T.isoToday, time: '09:00-11:00', status: '已签到', created: '08:31' },
    { id: 'AR003', name: '赵六', sno: '2024010104', room: 'C区自习室', seat: 'C区自习室 1F 02号', date: T.today, iso: T.isoToday, time: '10:00-12:00', status: '已完成', created: '09:50' },
    { id: 'AR004', name: '王五', sno: '2024010103', room: 'A区阅览室', seat: 'A区阅览室 1F 03号', date: T.today, iso: T.isoToday, time: '08:00-10:00', status: '违约', created: '07:42' },
    { id: 'AR005', name: '孙七', sno: '2024010105', room: 'D区电源区', seat: 'D区电源区 2F 04号', date: T.today, iso: T.isoToday, time: '13:00-17:00', status: '使用中', created: '12:48' },
    { id: 'AR006', name: '周八', sno: '2024010206', room: 'B区阅览室', seat: 'B区阅览室 2F 11号', date: T.today, iso: T.isoToday, time: '15:00-18:00', status: '已取消', created: '11:05' },
    { id: 'AR007', name: '吴九', sno: '2023010311', room: 'C区自习室', seat: 'C区自习室 3F 07号', date: T.y1, iso: T.isoY1, time: '18:00-20:00', status: '已完成', created: T.y1 + ' 17:30' },
    { id: 'AR008', name: '郑十', sno: '2024010207', room: 'A区阅览室', seat: 'A区阅览室 3F 09号', date: T.y1, iso: T.isoY1, time: '19:00-22:00', status: '违约', created: T.y1 + ' 18:15' },
    { id: 'AR009', name: '冯一', sno: '2023010408', room: 'D区电源区', seat: 'D区电源区 1F 06号', date: iso(shift(NOW, -2)), iso: iso(shift(NOW, -2)), time: '08:00-12:00', status: '已完成', created: '07:35' },
    { id: 'AR010', name: '陈二', sno: '2024010309', room: 'B区阅览室', seat: 'B区阅览室 3F 10号', date: iso(shift(NOW, -2)), iso: iso(shift(NOW, -2)), time: '14:00-16:00', status: '已完成', created: '13:20' }
  ];

  var STATS = {
    '本周': {
      usage: 71, total: 4568, booked: 3241, using: 186, violations: 23, peak: '14:00—16:00',
      days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      booked7: [412, 486, 455, 521, 648, 398, 321],
      free7: [158, 124, 156, 139, 82, 172, 201],
      hot: [['A区阅览室 2F 05号', 52], ['B区阅览室 1F 08号', 47], ['C区自习室 3F 02号', 39], ['D区电源区 2F 01号', 31]],
      college: [['信息工程学院', 328], ['经济管理学院', 256], ['外国语学院', 198], ['土木工程学院', 156], ['数理学院', 121]],
      hours: [['08:00—10:00', 18], ['10:00—12:00', 34], ['12:00—14:00', 46], ['14:00—16:00', 68], ['16:00—18:00', 57], ['18:00—20:00', 42], ['20:00—22:00', 25]]
    },
    '本月': {
      usage: 76, total: 19240, booked: 14622, using: 742, violations: 96, peak: '14:00—16:00',
      days: ['第 1 周', '第 2 周', '第 3 周', '第 4 周'],
      booked7: [3420, 3860, 3640, 4102],
      free7: [1080, 900, 950, 780],
      hot: [['B区阅览室 1F 08号', 198], ['A区阅览室 2F 05号', 176], ['D区电源区 3F 04号', 141], ['C区自习室 2F 09号', 118]],
      college: [['信息工程学院', 1180], ['经济管理学院', 902], ['外国语学院', 711], ['土木工程学院', 655], ['数理学院', 480]],
      hours: [['08:00—10:00', 15], ['10:00—12:00', 31], ['12:00—14:00', 44], ['14:00—16:00', 71], ['16:00—18:00', 59], ['18:00—20:00', 47], ['20:00—22:00', 28]]
    },
    '本学期': {
      usage: 73, total: 78650, booked: 57415, using: 2860, violations: 412, peak: '14:00—16:00',
      days: ['9 月', '10 月', '11 月', '12 月', '1 月'],
      booked7: [11200, 13480, 15260, 16890, 10585],
      free7: [3200, 2950, 2680, 2410, 1820],
      hot: [['A区阅览室 2F 05号', 1520], ['B区阅览室 1F 08号', 1388], ['C区自习室 3F 02号', 1205], ['D区电源区 2F 01号', 988]],
      college: [['信息工程学院', 8560], ['经济管理学院', 7120], ['外国语学院', 6090], ['土木工程学院', 5230], ['数理学院', 3860]],
      hours: [['08:00—10:00', 17], ['10:00—12:00', 33], ['12:00—14:00', 45], ['14:00—16:00', 69], ['16:00—18:00', 58], ['18:00—20:00', 44], ['20:00—22:00', 26]]
    }
  };

  var state = {
    role: 'student',
    floor: 2, room: 'A区阅览室',
    resTab: 'current',
    historyFilter: '全部',
    msgFilter: '全部',
    booking: { offset: 0, start: '14:00', duration: 2, seatId: null },
    pendingCancel: null, pendingRelease: null, pendingCheckin: null,
    currentRes: 'R2026091801',
    appealTargetId: null,
    seatEdit: { mode: 'add', id: null },
    appealAction: null,
    blacklistTarget: null,
    loginRole: 'student',
    dark: false
  };

  /* ============================== DOM 工具 ============================== */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function icon(path, size, sw) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }
  var ICON = {
    check: '<path d="M5 13l4 4L19 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    seat: '<path d="M4 18v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M3 18h18"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>',
    bell: '<path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.66V5a2 2 0 1 0-4 0v.34C7.67 6.17 6 8.39 6 11v3.16c0 .54-.21 1.05-.6 1.44L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/>',
    warn: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3.5-4 3 2.5L20 7"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    grid: '<rect x="3" y="3" width="7.5" height="8.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="6.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/>',
    plan: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    doc: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4m0-4h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  function badgeCls(s) { return BADGE[s] || 'badge--muted'; }
  function badge(s) { return '<span class="badge ' + badgeCls(s) + '">' + esc(s) + '</span>'; }
  function fullName(s) { return s.roomName + ' ' + s.floor + 'F ' + pad2(s.num) + '号'; }

  /* ============================== Toast ============================== */
  var toastTimer = null;
  function toast(msg, type) {
    var el = q('#toast');
    el.textContent = msg;
    el.className = 'toast is-show' + (type ? ' toast--' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2100);
  }

  /* ============================== 浮层 ============================== */
  function openOverlay(name) {
    var el = q('.overlay[data-overlay="' + name + '"]');
    if (el) el.classList.add('is-active');
  }
  function closeOverlay(name) {
    var el = q('.overlay[data-overlay="' + name + '"]');
    if (el) el.classList.remove('is-active');
  }
  function closeAllOverlays() { qa('.overlay').forEach(function (o) { o.classList.remove('is-active'); }); }

  /* ============================== 页面切换 ============================== */
  var history = [];
  var currentPage = 'login';

  function isAdminPage(name) { return name.indexOf('admin-') === 0; }

  function go(name, noPush) {
    var target = q('.page[data-page="' + name + '"]');
    if (!target) return;
    qa('.page').forEach(function (p) { p.classList.remove('is-active'); });
    target.classList.add('is-active');
    if (!noPush && currentPage !== name) history.push(currentPage);
    currentPage = name;
    closeAllOverlays();

    var phone = q('#phone');
    if (isAdminPage(name)) phone.classList.add('phone--wide');
    else phone.classList.remove('phone--wide');

    var body = target.querySelector('.page__body');
    if (body) body.scrollTop = 0;

    if (name === 'student-home') renderHome();
    else if (name === 'seat-detail') renderSeatDetail();
    else if (name === 'my-reservation') renderReservation();
    else if (name === 'history-list') renderHistory();
    else if (name === 'violation-list') renderViolation();
    else if (name === 'appeal-submit') renderAppealSubmit();
    else if (name === 'message-list') renderMessages();
    else if (name === 'profile') renderProfile();
    else if (name === 'checkin') startCheckin();
    else if (isAdminPage(name)) renderAdmin(name);

    syncDemoNav();
    syncHash();
  }

  /* 把当前页写入地址栏 hash，使任何页面都可直接分享跳转 */
  function syncHash() {
    if (!currentPage) return;
    var want = '#/page/' + currentPage;
    if (location.hash !== want) {
      try { history.replaceState(null, '', want); }
      catch (e) { location.hash = want; }
    }
  }

  function back() {
    var prev = history.pop();
    go(prev && prev !== currentPage ? prev : 'student-home', true);
  }

  /* ============================== 学生端首页 ============================== */
  function renderHome() {
    var chips = FLOORS.map(function (f) {
      return '<button class="chip' + (f === state.floor ? ' is-active' : '') + '" data-action="floor" data-floor="' + f + '">' + f + ' 层</button>';
    }).join('');
    q('#floorChips').innerHTML = chips;
    q('#roomChips').innerHTML = rooms.map(function (r) {
      return '<button class="chip' + (r.name === state.room ? ' is-active' : '') + '" data-action="room" data-room="' + esc(r.name) + '">' +
        esc(r.name) + '</button>';
    }).join('');

    var room = rooms.filter(function (r) { return r.name === state.room; })[0] || rooms[0];
    q('#seatTitle').innerHTML = esc(state.room) + ' · ' + state.floor + 'F <span class="xsmall muted" style="font-weight:500;margin-left:4px">' + esc(room.floorDesc) + '</span>';

    var list = seats.filter(function (s) { return s.roomName === state.room && s.floor === state.floor; });
    q('#seatGrid').innerHTML = list.map(function (s) {
      var meta = SEAT_STATUS[s.status];
      var mine = s.id === 'A2-05' && s.status === 'booked' ? '<span class="seat__flag">我</span>' : '';
      return '<button class="seat ' + meta.cls + (mine ? ' seat--mine' : '') + '" data-action="seat" data-seat="' + s.id + '" title="' + esc(fullName(s)) + ' · ' + meta.label + '">' +
        mine + '<span class="seat__num">' + pad2(s.num) + '</span><span class="seat__zone">' + (s.zone === '电源区' ? '电源' : '自习') + '</span></button>';
    }).join('');

    var free = seats.filter(function (s) { return s.status === 'free'; }).length;
    var using = seats.filter(function (s) { return s.status === 'using'; }).length;
    var mineCount = R.filter(function (r) { return r.status === '待签到' || r.status === '使用中'; }).length;
    q('#statFree').textContent = free;
    q('#statUsing').textContent = using;
    q('#statMine').textContent = mineCount;

    var unread = MSG.filter(function (m) { return m.unread; }).length;
    q('#msgDot').style.display = unread ? '' : 'none';
  }

  /* ============================== 座位详情 ============================== */
  var detailSeatId = null;
  function renderSeatDetail() {
    var s = seatMap[detailSeatId] || seatMap['A2-05'];
    if (!s) return;
    var meta = SEAT_STATUS[s.status];
    var mine = s.status === 'booked' && s.id === 'A2-05';
    q('#seatDetailBody').innerHTML =
      '<div class="seat-detail-hero">' +
        '<div class="row--between">' +
          '<div><div style="font-size:12px;opacity:.85">' + esc(s.roomName) + ' · ' + s.floor + 'F</div>' +
          '<div style="font-size:23px;font-weight:700;margin-top:2px">' + pad2(s.num) + ' 号座位</div></div>' +
          '<span class="badge" style="background:rgba(255,255,255,.22);color:#fff">' + meta.label + '</span>' +
        '</div>' +
        '<div style="font-size:11.5px;opacity:.85;margin-top:9px">座位编号 ' + esc(s.id) + ' · ' + esc(s.zone) + '</div>' +
      '</div>' +
      '<div class="card card--plain">' +
        '<div class="kv-list">' +
          '<div class="kv"><span class="kv__k">所属阅览室</span><span class="kv__v">' + esc(s.roomName) + '</span></div>' +
          '<div class="kv"><span class="kv__k">楼层</span><span class="kv__v">' + s.floor + "F" + '</span></div>' +
          '<div class="kv"><span class="kv__k">区域类型</span><span class="kv__v">' + esc(s.zone) + '</span></div>' +
          '<div class="kv"><span class="kv__k">今日可预约时段</span><span class="kv__v">08:00—22:00</span></div>' +
          '<div class="kv"><span class="kv__k">单次预约时长</span><span class="kv__v">1—4 小时</span></div>' +
          '<div class="kv"><span class="kv__k">签到窗口</span><span class="kv__v">开始前后 30 分钟</span></div>' +
        '</div>' +
      '</div>' +
      (s.status === 'free'
        ? '<button class="btn btn--primary btn--block btn--lg" data-action="book-seat" data-seat="' + s.id + '">预约该座位</button>'
        : '<div class="alert alert--warn"><span class="alert__icon">' + icon(ICON.info, 14, 2) + '</span><span>该座位当前为「' + meta.label + '」状态，暂不可预约。可返回首页选择其他绿色空闲座位。</span></div>' +
          '<button class="btn btn--ghost btn--block" data-action="back">返回座位列表</button>') +
      '<div class="tips-card">' +
        '<div class="tips-card__title">' + icon(ICON.info, 14, 2) + '预约提示</div>' +
        '<ul><li>同一时间只能预约 1 个座位（业务规则 BR-01）</li>' +
        '<li>预约开始前 30 分钟以上可自由取消</li>' +
        '<li>进入签到窗口后不可取消，未签到直接记违约</li></ul>' +
      '</div>';
    if (mine) toast('该座位正是你当前的预约', 'warn');
  }

  /* ============================== 预约流程 ============================== */
  function bookingSummary() {
    var b = state.booking;
    var start = toMin(b.start);
    var end = start + b.duration * 60;
    var d = shift(NOW, b.offset);
    return {
      dateLabel: ['今天', '明天', '后天'][b.offset] + '（' + md(d) + '）',
      time: hhmm(start) + ' - ' + hhmm(end),
      window: hhmm(start - 30) + ' - ' + hhmm(start + 30),
      end: end
    };
  }

  function openBooking(seatId) {
    state.booking.seatId = seatId;
    var s = seatMap[seatId];
    q('#bkSeatSub').textContent = fullName(s) + ' · ' + s.zone;
    q('#bkDates').innerHTML = [0, 1, 2].map(function (i) {
      var d = shift(NOW, i);
      return '<button class="segmented__item' + (i === state.booking.offset ? ' is-active' : '') + '" data-action="bk-date" data-offset="' + i + '">' +
        ['今天', '明天', '后天'][i] + ' ' + md(d) + '</button>';
    }).join('');
    var opts = '';
    for (var m = OPEN_MIN; m <= CLOSE_MIN - 60; m += 30) {
      opts += '<option value="' + hhmm(m) + '"' + (hhmm(m) === state.booking.start ? ' selected' : '') + '>' + hhmm(m) + '</option>';
    }
    q('#bkStart').innerHTML = opts;
    q('#bkDuration').value = String(state.booking.duration);
    refreshBookingSummary();
    openOverlay('booking');
  }

  function refreshBookingSummary() {
    var sum = bookingSummary();
    var s = seatMap[state.booking.seatId];
    q('#bkSummarySeat').textContent = s ? fullName(s) : '--';
    q('#bkSummaryTime').textContent = sum.time;
    q('#bkSummaryWindow').textContent = sum.window;
    q('#bkSummaryTime').style.color = sum.end > CLOSE_MIN ? 'var(--danger-600)' : '';
  }

  function confirmBooking() {
    var b = state.booking;
    var sum = bookingSummary();
    var s = seatMap[b.seatId];
    if (!s) return;
    if (sum.end > CLOSE_MIN) {
      toast('预约结束时间超出闭馆时间 22:00，请缩短时长', 'danger');
      return;
    }
    if (R.filter(function (r) { return r.status === '待签到' || r.status === '使用中'; }).length >= 1 && b.seatId !== 'A2-05') {
      toast('你已有进行中的预约，同一时间只能预约 1 个座位（BR-01）', 'danger');
      return;
    }
    if (s.status !== 'free') {
      toast('该座位已被占用，请选择其他座位', 'danger');
      closeOverlay('booking');
      return;
    }
    s.status = 'booked'; s.owner = '张三';
    var id = 'R' + (2026091900 + Math.floor(Math.random() * 99));
    R.unshift({
      id: id, seatId: s.id, seatName: fullName(s), room: s.roomName, zone: s.zone,
      date: md(shift(NOW, b.offset)), iso: iso(shift(NOW, b.offset)), start: hhmm(toMin(b.start)),
      end: hhmm(sum.end), status: '待签到', created: '刚刚', signWindow: sum.window
    });
    state.currentRes = id;
    q('#okSeat').textContent = fullName(s);
    q('#okDate').textContent = sum.dateLabel;
    q('#okTime').textContent = sum.time;
    q('#okNo').textContent = id;
    closeOverlay('booking');
    go('booking-success');
    toast('预约成功，请在 30 分钟内签到', 'ok');
  }

  /* ============================== 签到流程 ============================== */
  var cdTimer = null, cdLeft = 1798;
  function startCheckin() {
    var r = R.filter(function (x) { return x.id === state.currentRes; })[0] || R[0];
    if (!r) return;
    q('#ciSeat').textContent = r.seatName;
    q('#ciTime').textContent = r.start + ' - ' + r.end;
    q('#ciWindow').textContent = r.signWindow || (hhmm(toMin(r.start) - 30) + ' - ' + hhmm(toMin(r.start) + 30));
    drawQR('QR-' + r.id + '-' + r.seatId);
    clearInterval(cdTimer);
    cdLeft = 1798;
    tickCountdown();
    cdTimer = setInterval(function () {
      cdLeft -= 1;
      if (cdLeft <= 0) { clearInterval(cdTimer); cdLeft = 0; }
      tickCountdown();
    }, 1000);
  }
  function tickCountdown() {
    q('#cdText').textContent = pad2(Math.floor(cdLeft / 60)) + ':' + pad2(cdLeft % 60);
    q('#cdBar').style.width = Math.max(2, (cdLeft / 1800) * 100) + '%';
  }
  function doCheckin() {
    var r = R.filter(function (x) { return x.id === state.currentRes; })[0];
    if (r) {
      r.status = '使用中';
      r.signAt = '刚刚';
      var s = seatMap[r.seatId];
      if (s) { s.status = 'using'; s.owner = '张三'; }
      q('#ciConfirmText').textContent = r.seatName + ' 已签到成功，座位状态更新为「使用中」。离开时请手动释放座位，方便其他同学使用。';
    }
    clearInterval(cdTimer);
    openOverlay('checkin-confirm');
    toast('签到成功，状态已更新为使用中', 'ok');
  }

  /* 用确定性伪随机生成二维码样式矩阵（仅作视觉呈现） */
  function drawQR(seedStr) {
    var N = 25, seed = 7;
    for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var cells = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) cells.push(rnd() > 0.52 ? 1 : 0);
    function setBlock(x0, y0, v) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
        var edge = (x === 0 || x === 6 || y === 0 || y === 6);
        var core = (x >= 2 && x <= 4 && y >= 2 && y <= 4);
        cells[(y0 + y) * N + (x0 + x)] = (edge || core) ? 1 : 0;
      }
    }
    setBlock(0, 0); setBlock(N - 7, 0); setBlock(0, N - 7);
    var rects = '';
    var cell = 132 / N;
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      if (cells[yy * N + xx]) {
        rects += '<rect x="' + (xx * cell).toFixed(2) + '" y="' + (yy * cell).toFixed(2) +
          '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '" fill="#0f172a"/>';
      }
    }
    q('#qrSvg').innerHTML = '<rect width="132" height="132" fill="#ffffff"/>' + rects;
  }

  /* ============================== 我的预约 ============================== */
  function renderReservation() {
    var cur = R.filter(function (r) { return r.status === '待签到' || r.status === '使用中'; });
    var his = R.filter(function (r) { return ['已完成', '已取消', '违约'].indexOf(r.status) >= 0; });
    var list = state.resTab === 'current' ? cur : his;

    if (!list.length) {
      q('#resList').innerHTML = '<div class="empty"><div class="empty__icon">' + icon(ICON.doc, 30, 1.6) + '</div>' +
        '<div class="empty__title">' + (state.resTab === 'current' ? '当前没有进行中的预约' : '暂无历史记录') + '</div>' +
        '<div class="empty__text">' + (state.resTab === 'current' ? '回到首页选择绿色空闲座位，立即开始预约' : '完成一次预约后，记录会显示在这里') + '</div></div>' +
        (state.resTab === 'current' ? '<button class="btn btn--primary btn--block" data-action="go" data-target="student-home">去选座</button>' : '');
      return;
    }

    q('#resList').innerHTML = list.map(function (r) {
      var cls = r.status === '待签到' ? 'res-card--pending' : r.status === '使用中' ? 'res-card--using'
        : r.status === '违约' ? 'res-card--cancel' : r.status === '已取消' ? 'res-card--cancel' : 'res-card--done';
      var html = '<div class="res-card ' + cls + '"><i class="res-card__stripe"></i>' +
        '<div class="card__row"><div class="grow">' +
          '<div class="res-card__seat">' + esc(r.seatName) + '</div>' +
          '<div class="res-card__meta">' + icon(ICON.clock, 13, 1.9) + esc(r.date) + ' ' + esc(r.start) + '—' + esc(r.end) +
          '<span class="badge badge--muted">' + esc(r.zone) + '</span></div>' +
        '</div>' + badge(r.status) + '</div>';

      if (r.status === '待签到') {
        html += '<div class="res-card__countdown"><span class="label">' + icon(ICON.clock, 13, 2) + '签到剩余时间</span>' +
          '<span class="clock">29:58</span></div>';
      } else if (r.status === '使用中') {
        html += '<div class="alert alert--info" style="margin-top:11px">' + icon(ICON.check, 14, 2.4) +
          '<span>已签到，座位使用中。离开时请及时释放座位。</span></div>';
      } else if (r.status === '违约') {
        html += '<div class="alert alert--danger" style="margin-top:11px">' + icon(ICON.warn, 14, 2) +
          '<span>超时未签到，已记 1 次违约。如因特殊原因未能签到，可提交申诉。</span></div>';
      }

      var acts = '';
      if (r.status === '待签到') {
        acts = '<div class="res-card__actions">' +
          '<button class="btn btn--primary btn--sm" data-action="to-checkin" data-id="' + r.id + '">去签到</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="ask-cancel" data-id="' + r.id + '">取消预约</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="res-detail" data-id="' + r.id + '">详情</button></div>';
      } else if (r.status === '使用中') {
        acts = '<div class="res-card__actions">' +
          '<button class="btn btn--ok btn--sm" data-action="ask-release" data-id="' + r.id + '">释放座位</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="res-detail" data-id="' + r.id + '">详情</button></div>';
      } else if (r.status === '违约') {
        acts = '<div class="res-card__actions">' +
          '<button class="btn btn--outline btn--sm" data-action="to-appeal" data-id="' + r.id + '">提交申诉</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="res-detail" data-id="' + r.id + '">详情</button></div>';
      } else {
        acts = '<div class="res-card__actions">' +
          '<button class="btn btn--ghost btn--sm" data-action="rebook" data-seat="' + r.seatId + '">再次预约</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="res-detail" data-id="' + r.id + '">详情</button></div>';
      }
      return html + acts + '</div>';
    }).join('');
  }

  /* ============================== 预约历史 ============================== */
  function renderHistory() {
    var filters = ['全部', '已完成', '已取消', '违约'];
    q('#historyFilters').innerHTML = filters.map(function (f) {
      return '<button class="chip chip--sm' + (f === state.historyFilter ? ' is-active' : '') + '" data-action="his-filter" data-f="' + f + '">' + f + '</button>';
    }).join('');

    var list = R.filter(function (r) { return ['已完成', '已取消', '违约'].indexOf(r.status) >= 0; })
      .filter(function (r) { return state.historyFilter === '全部' || r.status === state.historyFilter; });

    if (!list.length) {
      q('#historyList').innerHTML = '<div class="empty"><div class="empty__icon">' + icon(ICON.doc, 30, 1.6) + '</div>' +
        '<div class="empty__title">暂无该类记录</div><div class="empty__text">换个筛选条件看看</div></div>';
      return;
    }
    q('#historyList').innerHTML = list.map(function (r) {
      var dot = r.status === '已完成' ? 'timeline__dot--ok' : r.status === '违约' ? 'timeline__dot--danger' : 'timeline__dot';
      return '<div class="timeline__item"><i class="timeline__dot ' + dot + '"></i>' +
        '<div class="card card--plain"><div class="card__row"><div class="grow">' +
        '<div class="card__title">' + esc(r.seatName) + '</div>' +
        '<div class="card__sub">' + esc(r.date) + ' ' + esc(r.start) + '—' + esc(r.end) + ' · 预约号 ' + esc(r.id) + '</div>' +
        '</div>' + badge(r.status) + '</div>' +
        (r.signAt ? '<div class="xsmall muted" style="margin-top:8px">签到时间：' + esc(r.signAt) + (r.releaseAt ? ' · 释放时间：' + esc(r.releaseAt) : '') + '</div>' : '') +
        (r.status === '违约' ? '<div class="xsmall" style="margin-top:8px;color:var(--danger-600)">原因：预约开始后 30 分钟内未签到</div>' : '') +
        '</div></div>';
    }).join('');
  }

  /* ============================== 违约记录 ============================== */
  function renderViolation() {
    var active = V.filter(function (v) { return v.status !== '已撤销'; }).length;
    q('#violationSummary').innerHTML =
      '<div class="card__row"><div class="grow"><div class="card__title">累计违约次数</div>' +
      '<div class="card__sub">当前生效中的违约共 ' + active + ' 次，满 3 次将自动加入黑名单</div></div>' +
      '<div style="font-size:26px;font-weight:700;color:' + (active >= 3 ? 'var(--danger-600)' : 'var(--ink-900)') + '">' + active + '<small style="font-size:12px;color:var(--ink-400)"> 次</small></div></div>' +
      '<div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="width:' + Math.min(100, active / 3 * 100) + '%;background:linear-gradient(90deg,#fbbf24,#ef4444)"></div></div>' +
      '<div class="xsmall muted" style="margin-top:7px">' + (active >= 3 ? '已达到黑名单阈值，当前处于禁约期' : '距离黑名单还有 ' + (3 - active) + ' 次') + '</div>';

    q('#violationList').innerHTML = V.map(function (v) {
      var canAppeal = v.status === '申诉中' ? false : v.status === '已驳回';
      return '<div class="card card--plain">' +
        '<div class="card__row"><div class="grow"><div class="card__title">' + esc(v.reason) + '</div>' +
        '<div class="card__sub">' + esc(v.seat) + ' · ' + esc(v.time) + '</div></div>' + badge(v.status) + '</div>' +
        '<div class="alert alert--muted" style="margin-top:10px">' + icon(ICON.info, 14, 2) + '<span>' + esc(v.note) + '</span></div>' +
        (v.status === '申诉中' ? '<div class="xsmall muted" style="margin-top:9px">申诉已提交，管理员将在 1 个工作日内处理</div>' : '') +
        (canAppeal ? '<button class="btn btn--outline btn--sm btn--block" style="margin-top:11px" data-action="to-appeal" data-id="' + v.resId + '">重新申诉</button>' : '') +
        '</div>';
    }).join('');
  }

  /* ============================== 提交申诉 ============================== */
  function renderAppealSubmit() {
    var r = R.filter(function (x) { return x.id === state.appealTargetId; })[0] || R.filter(function (x) { return x.status === '违约'; })[0];
    if (!r) {
      q('#appealTarget').innerHTML = '<div class="muted small">暂无可申诉的违约记录</div>';
      return;
    }
    state.appealTargetId = r.id;
    q('#appealTarget').innerHTML = '<div class="card__title">' + esc(r.seatName) + '</div>' +
      '<div class="card__sub">' + esc(r.date) + ' ' + esc(r.start) + '—' + esc(r.end) + ' · 违约原因：超时未签到</div>' +
      '<div class="xsmall muted" style="margin-top:8px">预约编号 ' + esc(r.id) + '</div>';
  }

  function submitAppeal() {
    var note = q('#appealNote').value.trim();
    if (note.length < 10) { toast('请填写不少于 10 个字的情况说明', 'danger'); q('#appealNote').focus(); return; }
    var r = R.filter(function (x) { return x.id === state.appealTargetId; })[0];
    var v = V.filter(function (x) { return x.resId === state.appealTargetId; })[0];
    if (v) { v.status = '申诉中'; v.note = note; }
    if (r) {
      APPEALS.unshift({
        id: 'AP' + Date.now().toString().slice(-8), name: '张三', sno: '2024010101',
        reason: '超时未签到', seat: r.seatName, time: r.date + ' ' + r.start + '-' + r.end,
        note: note, status: '申诉中', submitted: '刚刚', violations: V.filter(function (x) { return x.status !== '已撤销'; }).length
      });
    }
    q('#appealNote').value = '';
    toast('申诉已提交，请等待管理员处理', 'ok');
    go('violation-list');
  }

  /* ============================== 消息通知 ============================== */
  function renderMessages() {
    var filters = ['全部', '预约提醒', '系统通知', '违约提醒'];
    var map = { '全部': null, '预约提醒': 'remind', '系统通知': 'system', '违约提醒': 'violation' };
    q('#msgFilters').innerHTML = filters.map(function (f) {
      return '<button class="chip chip--sm' + (f === state.msgFilter ? ' is-active' : '') + '" data-action="msg-filter" data-f="' + f + '">' + f + '</button>';
    }).join('');

    var list = MSG.filter(function (m) { return !map[state.msgFilter] || m.type === map[state.msgFilter]; });
    if (!list.length) {
      q('#msgList').innerHTML = '<div class="empty"><div class="empty__icon">' + icon(ICON.bell, 30, 1.6) + '</div>' +
        '<div class="empty__title">暂无消息</div><div class="empty__text">预约提醒与系统通知会显示在这里</div></div>';
      return;
    }
    var iconMap = { remind: ICON.clock, system: ICON.bell, violation: ICON.warn };
    var clsMap = { remind: '', system: '', violation: 'msg-item__icon--warn' };
    q('#msgList').innerHTML = list.map(function (m) {
      return '<div class="msg-item' + (m.unread ? ' is-unread' : '') + '" data-action="read-msg" data-id="' + m.id + '">' +
        '<div class="msg-item__icon ' + (clsMap[m.type] || '') + '">' + icon(iconMap[m.type] || ICON.bell, 17, 1.9) + '</div>' +
        '<div class="grow"><div class="row--between"><span class="msg-item__title">' + esc(m.title) + '</span>' +
        '<span class="msg-item__time">' + esc(m.time) + '</span></div>' +
        '<div class="msg-item__text">' + esc(m.text) + '</div></div>' +
        (m.unread ? '<i class="unread-dot"></i>' : '') + '</div>';
    }).join('');
  }

  /* ============================== 个人中心 ============================== */
  function renderProfile() {
    var total = R.length + 24;
    var vcount = V.filter(function (v) { return v.status !== '已撤销'; }).length;
    q('#pStatTotal').textContent = total;
    q('#pStatViolation').textContent = vcount;
    q('#pViol').textContent = vcount + ' 次';
    var unread = MSG.filter(function (m) { return m.unread; }).length;
    var b = q('#pMsgBadge');
    b.textContent = unread;
    b.style.display = unread ? '' : 'none';
  }

  /* ============================== SVG 图表（离线绘制） ============================== */
  function donut(percent, size, thickness, colorA, colorB) {
    var r = (size - thickness) / 2, c = 2 * Math.PI * r;
    var off = c * (1 - percent / 100);
    var gid = 'g' + Math.random().toString(36).slice(2, 8);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + colorA + '"/><stop offset="1" stop-color="' + colorB + '"/></linearGradient></defs>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="' + thickness + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#' + gid + ')" stroke-width="' + thickness +
      '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '<text x="50%" y="47%" text-anchor="middle" font-size="' + (size * 0.22) + '" font-weight="700" fill="var(--ink-900)">' + percent + '%</text>' +
      '<text x="50%" y="63%" text-anchor="middle" font-size="' + (size * 0.085) + '" fill="var(--ink-500)">座位使用率</text>' +
      '</svg>';
  }

  function stackedBars(days, booked, free) {
    var W = 520, H = 208, padL = 34, padB = 24, padT = 10;
    var max = Math.max.apply(null, booked.map(function (b, i) { return b + free[i]; })) || 1;
    var innerW = W - padL - 10, innerH = H - padB - padT;
    var step = innerW / days.length;
    var bw = Math.min(26, step * 0.5);
    var parts = '';
    for (var g = 0; g <= 4; g++) {
      var y = padT + innerH - (innerH * g / 4);
      parts += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - 10) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="' + (padL - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="var(--ink-400)">' + Math.round(max * g / 4) + '</text>';
    }
    days.forEach(function (d, i) {
      var x = padL + step * i + (step - bw) / 2;
      var hb = innerH * booked[i] / max, hf = innerH * free[i] / max;
      parts += '<rect x="' + x.toFixed(1) + '" y="' + (padT + innerH - hb).toFixed(1) + '" width="' + bw + '" height="' + hb.toFixed(1) + '" rx="4" fill="url(#barGrad)"/>';
      parts += '<rect x="' + x.toFixed(1) + '" y="' + (padT + innerH - hb - hf).toFixed(1) + '" width="' + bw + '" height="' + hf.toFixed(1) + '" rx="4" fill="var(--surface-3)"/>';
      parts += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="10" fill="var(--ink-500)">' + esc(d) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="208" preserveAspectRatio="none">' +
      '<defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#5d86fb"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>' + parts + '</svg>';
  }

  function lineChart(labels, data) {
    var W = 520, H = 208, padL = 34, padB = 24, padT = 12;
    var max = Math.max.apply(null, data) * 1.15 || 1;
    var innerW = W - padL - 14, innerH = H - padB - padT;
    var step = labels.length > 1 ? innerW / (labels.length - 1) : innerW;
    var pts = data.map(function (v, i) { return [padL + step * i, padT + innerH - innerH * v / max]; });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = path + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + innerH) + ' L' + pts[0][0].toFixed(1) + ' ' + (padT + innerH) + ' Z';
    var parts = '';
    for (var g = 0; g <= 4; g++) {
      var y = padT + innerH - (innerH * g / 4);
      parts += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - 14) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="' + (padL - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="var(--ink-400)">' + Math.round(max * g / 4) + '</text>';
    }
    labels.forEach(function (l, i) {
      parts += '<text x="' + (padL + step * i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="10" fill="var(--ink-500)">' + esc(l) + '</text>';
    });
    pts.forEach(function (p, i) {
      parts += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.6" fill="var(--surface)" stroke="#2f62f2" stroke-width="2.4"/>';
      parts += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 9).toFixed(1) + '" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--ink-600)">' + data[i] + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="208" preserveAspectRatio="none">' +
      '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="rgba(47,98,242,.28)"/><stop offset="1" stop-color="rgba(47,98,242,0)"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#areaGrad)"/>' +
      '<path d="' + path + '" fill="none" stroke="#2f62f2" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      parts + '</svg>';
  }

  function rankList(items, unit) {
    var max = Math.max.apply(null, items.map(function (i) { return i[1]; })) || 1;
    return items.map(function (it, i) {
      return '<div class="rank-item"><span class="rank-item__no' + (i < 3 ? ' rank-item__no--' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
        '<div class="grow"><div class="row--between"><span class="rank-item__name">' + esc(it[0]) + '</span>' +
        '<span class="rank-item__val">' + it[1] + esc(unit || '') + '</span></div>' +
        '<div class="rank-item__bar"><span style="width:' + (it[1] / max * 100).toFixed(1) + '%"></span></div></div></div>';
    }).join('');
  }

  function barList(items, unit) {
    var max = Math.max.apply(null, items.map(function (i) { return i[1]; })) || 1;
    return items.map(function (it) {
      return '<div class="rank-item"><span class="rank-item__name" style="width:78px;flex:none">' + esc(it[0]) + '</span>' +
        '<div class="grow"><div class="rank-item__bar" style="margin-top:0"><span style="width:' + (it[1] / max * 100).toFixed(1) + '%;background:linear-gradient(90deg,#34d399,#059669)"></span></div></div>' +
        '<span class="rank-item__val">' + it[1] + '%</span></div>';
    }).join('');
  }

  /* ============================== 管理员端 ============================== */
  var adminState = { resDate: '', resRoom: '全部阅览室', resStatus: '全部状态', resKeyword: '', seatRoom: 'A区阅览室', seatKeyword: '', seatStatus: '全部状态', appealTab: 'pending', blacklistTab: 'active', statsRange: '本周', floorPlanRoom: 'A区阅览室' };

  function activeAdminPage() {
    if (currentPage.indexOf('admin-') === 0) {
      var p = q('.page[data-page="' + currentPage + '"]');
      if (p) return p;
    }
    return q('.page[data-page="admin-home"]');
  }
  function adminEl(sel) {
    /* 浮层（seat-edit / appeal-handle 等）是 #app 下的全局节点，不在管理员页面内部，
       因此必须先做全局查询，再退回当前页作用域。 */
    var global = document.querySelector(sel);
    if (global) return global;
    var p = activeAdminPage();
    return p ? p.querySelector(sel) : null;
  }
  function adminEls(sel) { var p = activeAdminPage(); return p ? qa(sel, p) : []; }
  function renderAdmin(name) {
    var page = q('.page[data-page="' + name + '"]');
    if (!page) return;
    var content = page.querySelector('.admin-content');
    if (!content) return;
    qa('.admin-nav__item', page).forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-target') === name);
    });
    var html = '';
    if (name === 'admin-home') html = viewAdminHome();
    else if (name === 'admin-seat') html = viewAdminSeat();
    else if (name === 'admin-floorplan') html = viewAdminFloorplan();
    else if (name === 'admin-reservation') html = viewAdminReservation();
    else if (name === 'admin-appeal') html = viewAdminAppeal();
    else if (name === 'admin-blacklist') html = viewAdminBlacklist();
    else if (name === 'admin-stats') html = viewAdminStats();
    content.innerHTML = html;
    bindAdminEvents(page);
  }
  function rerenderAdmin() { if (currentPage.indexOf('admin-') === 0) renderAdmin(currentPage); }

  function kpi(label, num, unit, foot, iconPath, tone) {
    return '<div class="kpi"><div class="kpi__head"><span class="kpi__label">' + label + '</span>' +
      '<span class="kpi__icon kpi__icon--' + tone + '">' + icon(iconPath, 16, 1.9) + '</span></div>' +
      '<div class="kpi__num">' + num + (unit ? '<small>' + unit + '</small>' : '') + '</div>' +
      '<div class="kpi__foot">' + foot + '</div></div>';
  }

  function viewAdminHome() {
    var free = seats.filter(function (s) { return s.status === 'free'; }).length;
    var using = seats.filter(function (s) { return s.status === 'using'; }).length;
    var booked = seats.filter(function (s) { return s.status === 'booked'; }).length;
    var usage = Math.round((seats.length - free) / seats.length * 100);
    var pending = APPEALS.filter(function (a) { return a.status === '申诉中'; }).length;

    return '<div class="kpi-grid">' +
      kpi('座位总数', seats.length, ' 个', '共 ' + rooms.length + ' 间阅览室 · ' + FLOORS.length + ' 个楼层', ICON.seat, 'brand') +
      kpi('今日预约', STATS['本周'].booked7[0], ' 次', '<span class="kpi__trend kpi__trend--up">↑ 12.4%</span> 较昨日', ICON.doc, 'ok') +
      kpi('使用中', using, ' 个', '当前实时占用 ' + usage + '%', ICON.clock, 'warn') +
      kpi('待处理申诉', pending, ' 条', '累计违约 ' + V.length + ' 条', ICON.chat, 'danger') +
      '</div>' +
      '<div class="panel-grid-2" style="margin-top:13px">' +
        '<div class="panel"><div class="panel__head"><div><div class="panel__title">近 7 日预约趋势</div>' +
        '<div class="panel__sub">蓝色为已预约座位数，灰色为空闲余量</div></div>' +
        '<div class="segmented segmented--sm" style="width:186px">' +
        ['本周', '本月', '本学期'].map(function (r) {
          return '<button class="segmented__item' + (r === adminState.statsRange ? ' is-active' : '') + '" data-action="stats-range" data-r="' + r + '">' + r + '</button>';
        }).join('') + '</div></div>' +
        '<div class="panel__body">' + stackedBars(STATS['本周'].days, STATS['本周'].booked7, STATS['本周'].free7) +
        '<div class="chart-legend"><span class="chart-legend__item"><i class="chart-legend__swatch" style="background:linear-gradient(140deg,#5d86fb,#1d4ed8)"></i>已预约</span>' +
        '<span class="chart-legend__item"><i class="chart-legend__swatch" style="background:var(--surface-3)"></i>空闲余量</span></div>' +
        '</div></div>' +
        '<div class="panel"><div class="panel__head"><div class="panel__title">座位使用率</div></div>' +
        '<div class="panel__body"><div class="donut-wrap">' + donut(usage, 132, 15, '#5d86fb', '#1d4ed8') +
        '<div class="stack-10 grow">' +
        '<div class="kv"><span class="kv__k">空闲</span><span class="kv__v">' + free + ' 个</span></div>' +
        '<div class="kv"><span class="kv__k">已预约</span><span class="kv__v">' + booked + ' 个</span></div>' +
        '<div class="kv"><span class="kv__k">使用中</span><span class="kv__v">' + using + ' 个</span></div>' +
        '</div></div></div></div>' +
      '</div>' +
      '<div class="panel-grid-2" style="margin-top:13px;grid-template-columns:1fr 1fr">' +
        '<div class="panel"><div class="panel__head"><div class="panel__title">热门座位排行</div>' +
        '<button class="link-btn" data-action="go" data-target="admin-stats">查看报表</button></div>' +
        '<div class="panel__body rank-list">' + rankList(STATS['本周'].hot, ' 次') + '</div></div>' +
        '<div class="panel"><div class="panel__head"><div class="panel__title">最新申诉待办</div>' +
        '<button class="link-btn" data-action="go" data-target="admin-appeal">全部处理</button></div>' +
        '<div class="panel__body stack-10">' +
        APPEALS.filter(function (a) { return a.status === '申诉中'; }).map(function (a) {
          return '<div class="appeal-card" style="box-shadow:none"><div class="appeal-card__head">' +
            '<div class="appeal-card__who"><div class="appeal-card__avatar">' + esc(a.name.charAt(0)) + '</div>' +
            '<div><div class="appeal-card__name">' + esc(a.name) + ' · ' + esc(a.sno) + '</div>' +
            '<div class="appeal-card__sno">' + esc(a.seat) + ' · ' + esc(a.time) + '</div></div></div>' + badge(a.status) + '</div>' +
            '<div class="appeal-card__note">' + esc(a.note) + '</div>' +
            '<div class="appeal-card__actions">' +
            '<button class="btn btn--ok btn--xs" data-action="appeal-pass" data-id="' + a.id + '">通过</button>' +
            '<button class="btn btn--ghost btn--xs" data-action="appeal-reject" data-id="' + a.id + '">驳回</button>' +
            '</div></div>';
        }).join('') + '</div></div>' +
      '</div>';
  }

  function viewAdminSeat() {
    var list = seats.filter(function (s) {
      var okRoom = s.roomName === adminState.seatRoom;
      var okKw = !adminState.seatKeyword || s.id.toLowerCase().indexOf(adminState.seatKeyword.toLowerCase()) >= 0;
      var okSt = adminState.seatStatus === '全部状态' || SEAT_STATUS[s.status].label === adminState.seatStatus;
      return okRoom && okKw && okSt;
    });
    return '<div class="panel"><div class="panel__head">' +
      '<div><div class="panel__title">座位资源维护</div><div class="panel__sub">共 ' + list.length + ' 个座位 · 支持新增、编辑、删除与区域标记（FR-06）</div></div>' +
      '<div class="toolbar">' +
      '<select class="select" data-admin="seat-room">' + rooms.map(function (r) {
        return '<option' + (r.name === adminState.seatRoom ? ' selected' : '') + '>' + esc(r.name) + '</option>';
      }).join('') + '</select>' +
      '<select class="select" data-admin="seat-status">' + ['全部状态', '空闲', '已预约', '使用中', '违规锁定'].map(function (s) {
        return '<option' + (s === adminState.seatStatus ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select>' +
      '<div class="search-box">' + icon(ICON.search, 15, 2) +
      '<input class="input" data-admin="seat-kw" value="' + esc(adminState.seatKeyword) + '" placeholder="搜索座位编号"></div>' +
      '<button class="btn btn--primary btn--sm" data-action="seat-add">' + icon(ICON.plus, 14, 2.4) + '新增座位</button>' +
      '</div></div>' +
      '<table class="data-table"><thead><tr><th>座位编号</th><th>所属阅览室</th><th>楼层</th><th>区域</th><th>状态</th><th>当前占用</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
      list.map(function (s) {
        return '<tr><td class="cell-strong mono">' + esc(s.id) + '</td><td>' + esc(s.roomName) + '</td>' +
          '<td class="mono">' + s.floor + 'F</td>' +
          '<td><span class="badge ' + (s.zone === '电源区' ? 'badge--ok' : 'badge--info') + '">' + esc(s.zone) + '</span></td>' +
          '<td><span class="badge ' + (s.status === 'free' ? 'badge--ok' : s.status === 'booked' ? 'badge--warn' : s.status === 'using' ? 'badge--danger' : 'badge--muted') + '">' + SEAT_STATUS[s.status].label + '</span></td>' +
          '<td class="muted">' + (s.owner ? esc(s.owner) : '—') + '</td>' +
          '<td><div class="cell-actions">' +
          '<button class="link-btn" data-action="seat-edit" data-seat="' + s.id + '">编辑</button>' +
          '<button class="link-btn link-btn--danger" data-action="seat-del" data-seat="' + s.id + '">删除</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function viewAdminFloorplan() {
    var list = seats.filter(function (s) { return s.roomName === adminState.floorPlanRoom && s.floor === 2; });
    var rows = [list.slice(0, 4), list.slice(4, 8), list.slice(8, 12)];
    function mini(s) {
      return '<button class="mini-seat mini-seat--' + s.status + '" data-action="seat-edit" data-seat="' + s.id + '" title="' + esc(fullName(s)) + ' · ' + SEAT_STATUS[s.status].label + '">' + pad2(s.num) + '</button>';
    }
    return '<div class="panel"><div class="panel__head">' +
      '<div><div class="panel__title">座位分布平面图</div><div class="panel__sub">点击任意座位可快速编辑状态与区域 · 红色为使用中，橙色为已预约，绿色为空闲</div></div>' +
      '<div class="toolbar"><select class="select" data-admin="plan-room">' +
      rooms.map(function (r) { return '<option' + (r.name === adminState.floorPlanRoom ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') +
      '</select><span class="badge badge--muted">2F</span></div></div>' +
      '<div class="panel__body"><div class="floorplan">' +
      rows.map(function (row, i) {
        return '<div class="floorplan__row"><span class="floorplan__label">' + (i === 1 ? '中排' : i === 0 ? '靠窗' : '靠墙') + '</span>' +
          '<div class="floorplan__seats">' + row.map(mini).join('') + '</div></div>' +
          (i < rows.length - 1 ? '<div class="passage" style="margin:10px 0"><span>通道</span></div>' : '');
      }).join('') +
      '</div>' +
      '<div class="chart-legend"><span class="chart-legend__item"><i class="chart-legend__swatch" style="background:var(--ok-500)"></i>空闲</span>' +
      '<span class="chart-legend__item"><i class="chart-legend__swatch" style="background:var(--warn-500)"></i>已预约</span>' +
      '<span class="chart-legend__item"><i class="chart-legend__swatch" style="background:var(--danger-500)"></i>使用中</span></div>' +
      '</div></div>';
  }

  function viewAdminReservation() {
    var list = ADMIN_RES.filter(function (r) {
      var okRoom = adminState.resRoom === '全部阅览室' || r.room === adminState.resRoom;
      var okDate = !adminState.resDate || r.iso === adminState.resDate;
      var stMap = { '待签到': '待签到', '使用中': '使用中', '已完成': '已完成', '已取消': '已取消', '违约': '违约', '已签到': '使用中' };
      var okSt = adminState.resStatus === '全部状态' || (stMap[r.status] || r.status) === adminState.resStatus;
      var okKw = !adminState.resKeyword || r.name.indexOf(adminState.resKeyword) >= 0 || r.sno.indexOf(adminState.resKeyword) >= 0;
      return okRoom && okDate && okSt && okKw;
    });
    return '<div class="panel"><div class="panel__head">' +
      '<div><div class="panel__title">全量预约数据</div><div class="panel__sub">共 ' + list.length + ' 条记录 · 支持按日期、阅览室、状态筛选（FR-07）</div></div>' +
      '<div class="toolbar">' +
      '<input type="date" class="input" data-admin="res-date" value="' + esc(adminState.resDate) + '">' +
      '<select class="select" data-admin="res-room"><option>全部阅览室</option>' + rooms.map(function (r) {
        return '<option' + (r.name === adminState.resRoom ? ' selected' : '') + '>' + esc(r.name) + '</option>';
      }).join('') + '</select>' +
      '<select class="select" data-admin="res-status">' + ['全部状态', '待签到', '使用中', '已完成', '已取消', '违约'].map(function (s) {
        return '<option' + (s === adminState.resStatus ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select>' +
      '<div class="search-box">' + icon(ICON.search, 15, 2) +
      '<input class="input" data-admin="res-kw" value="' + esc(adminState.resKeyword) + '" placeholder="搜索姓名 / 学号"></div>' +
      '<button class="btn btn--ghost btn--sm" data-action="export">导出 Excel</button>' +
      '</div></div>' +
      '<table class="data-table"><thead><tr><th>预约编号</th><th>学生</th><th>学号</th><th>座位</th><th>日期</th><th>时段</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) {
        var stLabel = r.status === '已签到' ? '使用中' : r.status;
        return '<tr><td class="mono muted">' + esc(r.id) + '</td><td class="cell-strong">' + esc(r.name) + '</td>' +
          '<td class="mono">' + esc(r.sno) + '</td><td>' + esc(r.seat) + '</td><td class="mono">' + esc(r.date) + '</td>' +
          '<td class="mono">' + esc(r.time) + '</td><td>' + badge(stLabel) + '</td>' +
          '<td><div class="cell-actions"><button class="link-btn" data-action="res-detail" data-id="' + r.id + '">详情</button>' +
          (r.status === '违约' ? '<button class="link-btn link-btn--danger" data-action="res-blacklist" data-id="' + r.id + '">拉黑</button>' : '') +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="8"><div class="empty"><div class="empty__title">没有符合条件的预约</div><div class="empty__text">尝试调整筛选条件</div></div></td></tr>') +
      '</tbody></table></div>';
  }

  function viewAdminAppeal() {
    var list = APPEALS.filter(function (a) {
      return adminState.appealTab === 'all' ? true : a.status === '申诉中';
    });
    var pending = APPEALS.filter(function (a) { return a.status === '申诉中'; }).length;
    return '<div class="panel"><div class="panel__head">' +
      '<div><div class="panel__title">违约申诉处理</div><div class="panel__sub">待处理 ' + pending + ' 条 · 通过后违约记录撤销并联动黑名单（FR-08 / UC-03）</div></div>' +
      '<div class="segmented segmented--sm" style="width:170px">' +
      '<button class="segmented__item' + (adminState.appealTab === 'pending' ? ' is-active' : '') + '" data-action="appeal-tab" data-t="pending">待处理</button>' +
      '<button class="segmented__item' + (adminState.appealTab === 'all' ? ' is-active' : '') + '" data-action="appeal-tab" data-t="all">全部</button>' +
      '</div></div>' +
      '<div class="panel__body stack-10">' +
      (list.length ? list.map(function (a) {
        return '<div class="appeal-card" style="box-shadow:none"><div class="appeal-card__head">' +
          '<div class="appeal-card__who"><div class="appeal-card__avatar">' + esc(a.name.charAt(0)) + '</div>' +
          '<div><div class="appeal-card__name">' + esc(a.name) + ' · ' + esc(a.sno) + '</div>' +
          '<div class="appeal-card__sno">' + esc(a.seat) + ' · ' + esc(a.time) + '</div></div></div>' +
          badge(a.status) + '</div>' +
          '<div class="appeal-card__note">' + esc(a.note) + '</div>' +
          '<div class="appeal-card__meta"><span>违约类型：' + esc(a.reason) + '</span><span>提交时间：' + esc(a.submitted) + '</span>' +
          '<span>该生累计违约：' + a.violations + ' 次</span>' +
          (a.handler ? '<span>处理人：' + esc(a.handler) + '</span>' : '') + '</div>' +
          (a.opinion ? '<div class="alert alert--muted" style="margin-top:10px">' + icon(ICON.info, 14, 2) + '<span>处理意见：' + esc(a.opinion) + '</span></div>' : '') +
          (a.status === '申诉中' ? '<div class="appeal-card__actions">' +
            '<button class="btn btn--ok btn--sm" data-action="appeal-pass" data-id="' + a.id + '">通过申诉（撤销违约）</button>' +
            '<button class="btn btn--ghost btn--sm" data-action="appeal-reject" data-id="' + a.id + '">驳回申诉</button></div>' : '') +
          '</div>';
      }).join('') : '<div class="empty"><div class="empty__title">暂无待处理申诉</div><div class="empty__text">所有申诉均已处理完成</div></div>') +
      '</div></div>';
  }

  function viewAdminBlacklist() {
    var list = BLACKLIST.filter(function (b) { return adminState.blacklistTab === 'all' ? true : b.status === '生效中'; });
    var active = BLACKLIST.filter(function (b) { return b.status === '生效中'; }).length;
    return '<div class="panel"><div class="panel__head">' +
      '<div><div class="panel__title">违约黑名单管理</div><div class="panel__sub">累计违约 3 次自动加入黑名单并禁约 7 天（BR-03）· 当前生效 ' + active + ' 人</div></div>' +
      '<div class="segmented segmented--sm" style="width:170px">' +
      '<button class="segmented__item' + (adminState.blacklistTab === 'active' ? ' is-active' : '') + '" data-action="bl-tab" data-t="active">生效中</button>' +
      '<button class="segmented__item' + (adminState.blacklistTab === 'all' ? ' is-active' : '') + '" data-action="bl-tab" data-t="all">全部记录</button>' +
      '</div></div>' +
      '<table class="data-table"><thead><tr><th>学号</th><th>姓名</th><th>学院</th><th>累计违约</th><th>加入日期</th><th>解除日期</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
      (list.length ? list.map(function (b) {
        return '<tr><td class="mono">' + esc(b.sno) + '</td><td class="cell-strong">' + esc(b.name) + '</td>' +
          '<td>' + esc(b.college) + '</td><td><span class="badge badge--danger">' + b.violations + ' 次</span></td>' +
          '<td class="mono">' + esc(b.since) + '</td><td class="mono">' + esc(b.until) + '</td>' +
          '<td>' + badge(b.status) + '</td>' +
          '<td><div class="cell-actions">' +
          (b.status === '生效中' ? '<button class="link-btn link-btn--danger" data-action="bl-release" data-id="' + b.id + '">解除</button>' : '<span class="muted xsmall">—</span>') +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="8"><div class="empty"><div class="empty__title">当前没有生效中的黑名单</div><div class="empty__text">所有学生均可正常预约</div></div></td></tr>') +
      '</tbody></table></div>';
  }

  function viewAdminStats() {
    var S = STATS[adminState.statsRange];
    return '<div class="toolbar" style="margin-bottom:13px">' +
      '<div class="segmented segmented--sm" style="width:250px">' +
      ['本周', '本月', '本学期'].map(function (r) {
        return '<button class="segmented__item' + (r === adminState.statsRange ? ' is-active' : '') + '" data-action="stats-range" data-r="' + r + '">' + r + '</button>';
      }).join('') + '</div>' +
      '<span class="badge badge--muted">数据来源：座位预约记录表 D3</span>' +
      '<button class="btn btn--ghost btn--sm" data-action="export">导出报表</button></div>' +
      '<div class="kpi-grid">' +
      kpi('总预约次数', S.total.toLocaleString(), ' 次', adminState.statsRange + '累计', ICON.doc, 'brand') +
      kpi('座位使用率', S.usage, '%', '高峰时段 ' + S.peak, ICON.chart, 'ok') +
      kpi('使用中座位', S.using, ' 个', '实时统计', ICON.seat, 'warn') +
      kpi('违约记录', S.violations, ' 条', '违约率 ' + (S.violations / S.total * 100).toFixed(2) + '%', ICON.warn, 'danger') +
      '</div>' +
      '<div class="panel-grid-2" style="margin-top:13px">' +
        '<div class="panel"><div class="panel__head"><div><div class="panel__title">预约量趋势</div>' +
        '<div class="panel__sub">' + adminState.statsRange + '各' + (adminState.statsRange === '本学期' ? '月' : adminState.statsRange === '本月' ? '周' : '日') + '预约总次数</div></div></div>' +
        '<div class="panel__body">' + lineChart(S.days, S.booked7) + '</div></div>' +
        '<div class="panel"><div class="panel__head"><div class="panel__title">时段热度分布</div></div>' +
        '<div class="panel__body stack-12">' + barList(S.hours) + '</div></div>' +
      '</div>' +
      '<div class="panel-grid-2" style="margin-top:13px">' +
        '<div class="panel"><div class="panel__head"><div><div class="panel__title">热门座位排行</div>' +
        '<div class="panel__sub">按预约次数统计，可用于优化座位资源配置</div></div></div>' +
        '<div class="panel__body rank-list">' + rankList(S.hot, ' 次') + '</div></div>' +
        '<div class="panel"><div class="panel__head"><div><div class="panel__title">学院使用排行</div>' +
        '<div class="panel__sub">按预约人次统计</div></div></div>' +
        '<div class="panel__body rank-list">' + rankList(S.college, ' 次') + '</div></div>' +
      '</div>';
  }

  /* ============================== 管理员端事件绑定 ============================== */
  function bindAdminEvents(scope) {
    qa('[data-admin]', scope).forEach(function (el) {
      var key = el.getAttribute('data-admin');
      var ev = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
      el.addEventListener(ev, function () {
        if (key === 'seat-room') adminState.seatRoom = el.value;
        else if (key === 'seat-status') adminState.seatStatus = el.value;
        else if (key === 'seat-kw') adminState.seatKeyword = el.value;
        else if (key === 'plan-room') adminState.floorPlanRoom = el.value;
        else if (key === 'res-date') adminState.resDate = el.value;
        else if (key === 'res-room') adminState.resRoom = el.value;
        else if (key === 'res-status') adminState.resStatus = el.value;
        else if (key === 'res-kw') adminState.resKeyword = el.value;
        rerenderAdmin();
        if (key === 'seat-kw' || key === 'res-kw') {
          var again = adminEl('[data-admin="' + key + '"]');
          if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
        }
      });
    });
  }

  /* ============================== 事件委托 ============================== */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    var ov = e.target.closest('.overlay');
    if (ov && e.target === ov) { ov.classList.remove('is-active'); return; }
    if (!t) return;
    var a = t.getAttribute('data-action');
    var id = t.getAttribute('data-id');
    var seatId = t.getAttribute('data-seat');

    switch (a) {
      /* 全局 */
      case 'go': go(t.getAttribute('data-target')); break;
      case 'back': back(); break;
      case 'logout':
        history = [];
        go('login', true);
        toast('已退出登录');
        break;
      case 'toggle-theme': setTheme(!state.dark); break;
      case 'toggle-anno':
      case 'toggle-list':
        toggleList();
        break;

      /* 登录 */
      case 'login-role':
        state.loginRole = t.getAttribute('data-role');
        qa('[data-action="login-role"]').forEach(function (b) { b.classList.toggle('is-active', b === t); });
        q('#loginFormStudent').classList.toggle('hidden', state.loginRole !== 'student');
        q('#loginFormAdmin').classList.toggle('hidden', state.loginRole !== 'admin');
        break;
      case 'student-login':
        history = [];
        go('student-home', true);
        toast('登录成功，欢迎回来', 'ok');
        break;
      case 'admin-login':
        history = [];
        go('admin-home', true);
        toast('已进入管理后台', 'ok');
        break;

      /* 首页筛选 */
      case 'floor':
        state.floor = +t.getAttribute('data-floor');
        renderHome();
        break;
      case 'room':
        state.room = t.getAttribute('data-room');
        renderHome();
        break;

      /* 座位 */
      case 'seat':
        detailSeatId = seatId;
        go('seat-detail');
        break;
      case 'book-seat':
      case 'rebook':
        openBooking(seatId);
        break;
      case 'bk-date':
        state.booking.offset = +t.getAttribute('data-offset');
        qa('[data-action="bk-date"]').forEach(function (b) { b.classList.toggle('is-active', b === t); });
        refreshBookingSummary();
        break;
      case 'confirm-booking': confirmBooking(); break;

      /* 签到 */
      case 'to-checkin':
        state.currentRes = id || state.currentRes;
        go('checkin');
        break;
      case 'do-checkin': doCheckin(); break;

      /* 我的预约 */
      case 'res-tab':
        state.resTab = t.getAttribute('data-tab');
        qa('[data-action="res-tab"]').forEach(function (b) { b.classList.toggle('is-active', b === t); });
        renderReservation();
        break;
      case 'ask-cancel': state.pendingCancel = id; openOverlay('cancel-confirm'); break;
      case 'do-cancel':
        (function () {
          var r = R.filter(function (x) { return x.id === state.pendingCancel; })[0];
          if (r) {
            r.status = '已取消';
            var s = seatMap[r.seatId];
            if (s) { s.status = 'free'; s.owner = null; }
          }
          closeOverlay('cancel-confirm');
          renderReservation();
          toast('预约已取消，座位已释放', 'ok');
        })();
        break;
      case 'ask-release': state.pendingRelease = id; openOverlay('release-confirm'); break;
      case 'do-release':
        (function () {
          var r = R.filter(function (x) { return x.id === state.pendingRelease; })[0];
          if (r) {
            r.status = '已完成'; r.releaseAt = '刚刚';
            var s = seatMap[r.seatId];
            if (s) { s.status = 'free'; s.owner = null; }
          }
          closeOverlay('release-confirm');
          renderReservation();
          toast('座位已释放，感谢配合', 'ok');
        })();
        break;
      case 'res-detail':
        (function () {
          var r = R.filter(function (x) { return x.id === id; })[0];
          var ar = ADMIN_RES.filter(function (x) { return x.id === id; })[0];
          var body = q('#resDetailBody');
          if (r) {
            body.innerHTML =
              '<div class="kv"><span class="kv__k">预约编号</span><span class="kv__v">' + esc(r.id) + '</span></div>' +
              '<div class="kv"><span class="kv__k">座位</span><span class="kv__v">' + esc(r.seatName) + '</span></div>' +
              '<div class="kv"><span class="kv__k">日期</span><span class="kv__v">' + esc(r.date) + '</span></div>' +
              '<div class="kv"><span class="kv__k">时段</span><span class="kv__v">' + esc(r.start) + '—' + esc(r.end) + '</span></div>' +
              '<div class="kv"><span class="kv__k">签到窗口</span><span class="kv__v">' + esc(r.signWindow || '—') + '</span></div>' +
              '<div class="kv"><span class="kv__k">状态</span><span class="kv__v">' + esc(r.status) + '</span></div>' +
              '<div class="kv"><span class="kv__k">创建时间</span><span class="kv__v">' + esc(r.created) + '</span></div>';
          } else if (ar) {
            body.innerHTML =
              '<div class="kv"><span class="kv__k">预约编号</span><span class="kv__v">' + esc(ar.id) + '</span></div>' +
              '<div class="kv"><span class="kv__k">学生</span><span class="kv__v">' + esc(ar.name) + '（' + esc(ar.sno) + '）</span></div>' +
              '<div class="kv"><span class="kv__k">座位</span><span class="kv__v">' + esc(ar.seat) + '</span></div>' +
              '<div class="kv"><span class="kv__k">日期</span><span class="kv__v">' + esc(ar.date) + '</span></div>' +
              '<div class="kv"><span class="kv__k">时段</span><span class="kv__v">' + esc(ar.time) + '</span></div>' +
              '<div class="kv"><span class="kv__k">状态</span><span class="kv__v">' + esc(ar.status) + '</span></div>';
          }
          openOverlay('res-detail');
        })();
        break;

      /* 历史 / 违约 / 申诉 */
      case 'his-filter': state.historyFilter = t.getAttribute('data-f'); renderHistory(); break;
      case 'to-appeal': state.appealTargetId = id; go('appeal-submit'); break;
      case 'submit-appeal': submitAppeal(); break;

      /* 消息 */
      case 'msg-filter': state.msgFilter = t.getAttribute('data-f'); renderMessages(); break;
      case 'read-msg':
        MSG.forEach(function (m) { if (m.id === id) m.unread = false; });
        renderMessages(); renderProfile();
        break;
      case 'read-all':
        MSG.forEach(function (m) { m.unread = false; });
        renderMessages(); renderProfile();
        toast('已全部标记为已读', 'ok');
        break;

      /* 浮层 */
      case 'open-overlay': openOverlay(t.getAttribute('data-overlay')); break;
      case 'close-overlay':
        closeOverlay(t.getAttribute('data-overlay'));
        var then = t.getAttribute('data-then');
        if (then) go(then);
        break;

      /* 管理员：座位 */
      case 'seat-add':
        state.seatEdit = { mode: 'add', id: null };
        adminEl('#seatEditTitle').textContent = '新增座位';
        adminEl('#seatEditNo').value = '';
        adminEl('#seatEditRoom').innerHTML = rooms.map(function (r) { return '<option>' + esc(r.name) + '</option>'; }).join('');
        adminEl('#seatEditZone').value = '自习区';
        adminEl('#seatEditStatus').value = 'free';
        openOverlay('seat-edit');
        break;
      case 'seat-edit':
        (function () {
          var s = seatMap[seatId];
          if (!s) return;
          state.seatEdit = { mode: 'edit', id: seatId };
          adminEl('#seatEditTitle').textContent = '编辑座位 · ' + seatId;
          adminEl('#seatEditNo').value = s.id;
          adminEl('#seatEditRoom').innerHTML = rooms.map(function (r) {
            return '<option' + (r.name === s.roomName ? ' selected' : '') + '>' + esc(r.name) + '</option>';
          }).join('');
          adminEl('#seatEditZone').value = s.zone;
          adminEl('#seatEditStatus').value = s.status;
          openOverlay('seat-edit');
        })();
        break;
      case 'save-seat':
        (function () {
          var s = seatMap[state.seatEdit.id];
          if (s) {
            s.zone = adminEl('#seatEditZone').value;
            s.status = adminEl('#seatEditStatus').value;
            s.owner = s.status === 'free' ? null : (s.owner || '张三');
          }
          closeOverlay('seat-edit');
          rerenderAdmin();
          toast('座位信息已保存', 'ok');
        })();
        break;
      case 'seat-del':
        (function () {
          var s = seatMap[seatId];
          if (!s) return;
          seats = seats.filter(function (x) { return x.id !== seatId; });
          delete seatMap[seatId];
          rerenderAdmin();
          toast('座位 ' + seatId + ' 已删除', 'warn');
        })();
        break;

      /* 管理员：申诉 */
      case 'appeal-tab': adminState.appealTab = t.getAttribute('data-t'); rerenderAdmin(); break;
      case 'appeal-pass': state.appealAction = { id: id, type: 'pass' }; openAppealHandle('pass'); break;
      case 'appeal-reject': state.appealAction = { id: id, type: 'reject' }; openAppealHandle('reject'); break;
      case 'confirm-appeal-handle': confirmAppealHandle(); break;

      /* 管理员：黑名单 */
      case 'bl-tab': adminState.blacklistTab = t.getAttribute('data-t'); rerenderAdmin(); break;
      case 'bl-release':
        state.blacklistTarget = id;
        openOverlay('blacklist-release');
        break;
      case 'confirm-blacklist-release':
        BLACKLIST.forEach(function (b) { if (b.id === state.blacklistTarget) { b.status = '已解除'; b.reason = '管理员人工解除'; } });
        closeOverlay('blacklist-release');
        rerenderAdmin();
        toast('已解除黑名单，该学生可正常预约', 'ok');
        break;
      case 'res-blacklist':
        toast('已将该学生加入黑名单观察名单');
        break;

      /* 管理员：统计 / 导出 */
      case 'stats-range':
        adminState.statsRange = t.getAttribute('data-r');
        rerenderAdmin();
        break;
      case 'export':
        toast('报表导出任务已创建，稍后可在下载中心查看', 'ok');
        break;
    }
  });

  /* 预约弹窗内联变更 */
  document.addEventListener('change', function (e) {
    if (e.target.id === 'bkStart') { state.booking.start = e.target.value; refreshBookingSummary(); }
    if (e.target.id === 'bkDuration') { state.booking.duration = +e.target.value; refreshBookingSummary(); }
  });

  /* ============================== 申诉处理浮层 ============================== */
  function openAppealHandle(type) {
    var isPass = type === 'pass';
    adminEl('#appealHandleTitle').textContent = isPass ? '确认通过申诉？' : '确认驳回申诉？';
    adminEl('#appealHandleText').textContent = isPass
      ? '通过后该违约记录将被撤销，不计入黑名单累计次数；若该学生已因本次违约进入黑名单，将同步解除。'
      : '驳回后违约记录维持有效，并计入黑名单累计次数。请填写驳回理由。';
    adminEl('#appealHandleIcon').className = 'dialog__icon ' + (isPass ? 'dialog__icon--ok' : 'dialog__icon--danger');
    adminEl('#appealHandleReason').placeholder = isPass ? '填写处理意见（可选）' : '请填写驳回理由（必填）';
    adminEl('#appealHandleReason').value = '';
    openOverlay('appeal-handle');
  }

  function confirmAppealHandle() {
    var act = state.appealAction;
    if (!act) return;
    var reason = adminEl('#appealHandleReason').value.trim();
    if (act.type === 'reject' && reason.length < 4) { toast('驳回申诉需填写理由', 'danger'); return; }
    APPEALS.forEach(function (a) {
      if (a.id !== act.id) return;
      a.status = act.type === 'pass' ? '已撤销' : '已驳回';
      a.handledAt = '刚刚';
      a.handler = '李老师';
      a.opinion = reason || (act.type === 'pass' ? '情况属实，撤销本次违约记录。' : '');
    });
    closeOverlay('appeal-handle');
    rerenderAdmin();
    toast(act.type === 'pass' ? '申诉已通过，违约记录已撤销' : '申诉已驳回，违约记录维持有效', act.type === 'pass' ? 'ok' : 'warn');
  }

  /* ============================== 主题 ============================== */
  function setTheme(dark) {
    state.dark = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var label = q('#themeLabel');
    if (label) label.textContent = dark ? '切换浅色模式' : '切换深色模式';
  }

  /* ============================== 页面清单导航 ============================== */
  var embedMode = false;

  function toggleList() {
    if (embedMode) return;
    var head = q('#stageHead');
    var dn = q('#demoNav');
    var show = !(dn && dn.classList.contains('is-shown'));
    if (head) head.classList.toggle('is-hidden', !show);
    if (dn) dn.classList.toggle('is-shown', show);
    var label = q('#themeLabel');
    if (label) label.textContent = show ? '隐藏页面清单' : '显示页面清单';
  }

  function buildDemoNav() {
    var names = Object.keys(PAGE_META);
    if (q('#pageTotal')) q('#pageTotal').textContent = names.length;
    q('#demoNav').innerHTML = names.map(function (n) {
      return '<button data-nav="' + n + '">' + PAGE_META[n] + '</button>';
    }).join('');
    qa('#demoNav button').forEach(function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-nav')); });
    });
  }

  /* 解析目标页：支持 ?page=xxx 与 #/page/xxx（后者链接更稳定，便于分享跳转） */
  function pageFromLocation(params) {
    var fromQuery = params.get('page');
    if (fromQuery) return fromQuery;
    var m = /^#\/?page\/([A-Za-z0-9_-]+)/.exec(location.hash || '');
    return m ? m[1] : null;
  }

  /* 内嵌演示模式（?embed=1&page=xxx&dark=1）：隐藏外框，只留手机屏，便于截图 */
  function applyEmbedMode(params) {
    var page = pageFromLocation(params);
    var dark = params.get('dark');
    if (dark === '1') setTheme(true);
    if (params.get('embed') === '1') {
      embedMode = true;
      document.body.classList.add('embed-mode');
      q('#stage').classList.add('stage--embed');
    }
    if (page) go(page, true);
  }

  /* ============================== 管理员端页面外壳生成 ============================== */
  var ADMIN_NAV = [
    { group: '运营概览', items: [{ t: 'admin-home', n: '数据概览', i: ICON.grid }] },
    { group: '座位资源', items: [
      { t: 'admin-seat', n: '座位与阅览室维护', i: ICON.seat },
      { t: 'admin-floorplan', n: '座位分布平面图', i: ICON.plan }
    ] },
    { group: '预约与合规', items: [
      { t: 'admin-reservation', n: '全量预约数据', i: ICON.doc },
      { t: 'admin-appeal', n: '违约申诉处理', i: ICON.chat },
      { t: 'admin-blacklist', n: '黑名单管理', i: ICON.ban }
    ] },
    { group: '数据分析', items: [{ t: 'admin-stats', n: '统计报表', i: ICON.chart }] }
  ];

  function adminShell(name) {
    var title = ADMIN_TITLES[name];
    var navHtml = ADMIN_NAV.map(function (g) {
      return '<div class="admin-nav__group">' + g.group + '</div><nav class="admin-nav">' +
        g.items.map(function (it) {
          return '<button class="admin-nav__item' + (it.t === name ? ' is-active' : '') + '" data-action="go" data-target="' + it.t + '">' +
            icon(it.i, 16, 1.9) + esc(it.n) + '</button>';
        }).join('') + '</nav>';
    }).join('');

    return '<div class="admin-shell">' +
      '<aside class="admin-side">' +
        '<div class="admin-side__brand">' +
          '<div class="admin-side__mark">' +
            icon('<path d="M12 6.04A8.97 8.97 0 0 0 6 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 0 1 6 18c2.3 0 4.41.87 6 2.29m0-14.25a8.97 8.97 0 0 1 6-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0 0 18 18a8.97 8.97 0 0 0-6 2.29m0-14.25v14.25"/>', 18, 1.7) +
          '</div>' +
          '<div><div class="admin-side__name">座位预约管理后台</div><div class="admin-side__sub">图书馆阅览座位预约</div></div>' +
        '</div>' +
        navHtml +
        '<div class="admin-side__foot">' +
          '<div class="admin-user"><div class="admin-user__avatar">李</div>' +
          '<div class="grow"><div class="admin-user__name">李老师</div><div class="admin-user__role">图书馆管理员</div></div></div>' +
          '<button class="admin-nav__item" style="margin-top:8px" data-action="logout">' + icon(ICON.out, 16, 1.9) + '退出登录</button>' +
        '</div>' +
      '</aside>' +
      '<div class="admin-main">' +
        '<header class="admin-topbar">' +
          '<div><div class="admin-topbar__title">' + esc(title[0]) + '</div>' +
          '<div class="admin-topbar__crumb">' + esc(title[1]) + '</div></div>' +
          '<div class="toolbar">' +
            '<span class="badge badge--ok">系统运行正常</span>' +
            '<span class="badge badge--muted">数据更新于 ' + T.today + ' ' + hhmm(NOW.getHours() * 60 + NOW.getMinutes()) + '</span>' +
          '</div>' +
        '</header>' +
        '<div class="admin-content"></div>' +
      '</div>' +
    '</div>';
  }

  function mountAdminPages() {
    var slot = q('.page[data-page="admin-mount"]');
    if (!slot) return;
    /* 每个管理员页只放“侧栏 + 顶栏 + 内容区”外壳；浮层（弹窗）只保留在文档末尾一份，
       避免 #seatEditTitle / #appealHandleTitle 等 id 重复导致取到别的页面的元素。 */
    Object.keys(ADMIN_TITLES).forEach(function (n) {
      var sec = document.createElement('section');
      sec.className = 'page';
      sec.setAttribute('data-page', n);
      sec.innerHTML = adminShell(n);
      slot.parentNode.insertBefore(sec, slot);
    });
    slot.parentNode.removeChild(slot);
  }

  /* ============================== 初始化 ============================== */
  function init() {
    mountAdminPages();
    buildDemoNav();
    setTheme(false);
    drawQR('QR-init');
    var params = new URLSearchParams(location.search);
    applyEmbedMode(params);
    if (!pageFromLocation(params)) renderHome();
    syncDemoNav();
    /* 支持浏览器前进/后退与直接分享带 #/page/xxx 的链接 */
    window.addEventListener('hashchange', function () {
      var t = pageFromLocation(new URLSearchParams(location.search));
      if (t && t !== currentPage) go(t, true);
    });
  }

  function syncDemoNav() {
    qa('#demoNav button').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-nav') === currentPage);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
