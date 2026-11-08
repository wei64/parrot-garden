/* 听人说话 · 小花园
   点左侧按钮加分（一天 +1、一周 +3、一月 +6、一季 +18、一年 +20），
   点右侧按钮扣分（一次 −2、两次 −4、三次 −6、四次 −8、五次 −10），
   分数每涨 1 分，花园里就多长一株花草。 */

(function () {
  'use strict';

  var STORAGE_KEY = 'listen-garden-score-v1';
  var MAX_PLANTS = 20;

  var PETALS = ['#c3a4ee', '#efa6c7', '#f6c49c', '#f8e08f', '#a9cdf3', '#dfaeee'];
  var CENTERS = ['#f8d264', '#ffdc7d', '#f4cf62'];
  var GREENS = ['#5ba86e', '#63b276', '#4f9d66'];

  var scoreValue = document.getElementById('scoreValue');
  var scoreTip = document.getElementById('scoreTip');
  var scorePill = document.querySelector('.score-pill');
  var gardenEl = document.getElementById('garden');
  var plantsEl = document.getElementById('plants');
  var undoBtn = document.getElementById('undoBtn');
  var resetBtn = document.getElementById('resetBtn');

  var state = { score: 0, history: [] };
  var plantEls = [];
  var emptyHint = null;

  /* ---------- 存储 ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || typeof data.score !== 'number' || !isFinite(data.score)) return;
      state.score = Math.max(0, Math.floor(data.score));
      if (Array.isArray(data.history)) {
        state.history = data.history
          .filter(function (item) {
            return item && typeof item.prev === 'number' && isFinite(item.prev);
          })
          .slice(-50);
      }
    } catch (err) {
      /* 隐私模式或存储损坏时，按新游戏开始 */
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ score: state.score, history: state.history.slice(-50) })
      );
    } catch (err) {
      /* 存不上就只影响下次打开，不影响本次游玩 */
    }
  }

  /* ---------- 花草绘制 ---------- */

  // 固定种子的小随机数，保证同一株每次重画都长得一样
  function rnd(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function stem(d) {
    return (
      '<path d="' + d + '" fill="none" stroke="' + GREENS[0] +
      '" stroke-width="5" stroke-linecap="round"/>'
    );
  }

  function leaves() {
    return (
      '<path d="M50 110 C 38 106 30 98 28 88 C 40 88 48 96 50 106 Z" fill="#6bbb7e"/>' +
      '<path d="M50 96 C 62 92 70 84 72 74 C 60 74 52 82 50 92 Z" fill="#82cb92"/>'
    );
  }

  function roundFlower(petal, center, count, radius) {
    var petals = '';
    for (var i = 0; i < count; i++) {
      petals +=
        '<ellipse cx="50" cy="' + (50 - radius) + '" rx="' + (radius * 0.62) +
        '" ry="' + radius + '" fill="' + petal + '" transform="rotate(' +
        (i * (360 / count)) + ' 50 50)" opacity=".96"/>';
    }
    return petals + '<circle cx="50" cy="50" r="7" fill="' + center + '"/>';
  }

  function svgWrap(inner, tall) {
    return (
      '<svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
      inner +
      '</svg>'
    );
  }

  function flowerRound(petal, center) {
    return svgWrap(
      stem('M50 128 C 47 106 53 90 50 60') + leaves() + roundFlower(petal, center, 6, 15)
    );
  }

  function flowerSmall(petal, center) {
    return svgWrap(
      stem('M50 128 C 46 108 54 96 50 74') + leaves() +
      roundFlower(petal, center, 5, 11)
    );
  }

  function tulip(petal) {
    return svgWrap(
      stem('M50 128 C 47 108 53 94 50 70') + leaves() +
      '<path d="M31 64 Q29 38 38 28 Q42 44 50 46 Q58 44 62 28 Q71 38 69 64 Q50 80 31 64 Z" fill="' +
      petal + '"/>' +
      '<path d="M43 52 L45 66 M57 52 L55 66" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round" fill="none"/>'
    );
  }

  function lavender(petal) {
    var buds = '';
    var i;
    for (i = 0; i < 4; i++) {
      var y = 46 - i * 9;
      buds +=
        '<circle cx="' + (44 - i * 1.5) + '" cy="' + y + '" r="5.5" fill="' + petal + '" opacity=".9"/>' +
        '<circle cx="' + (56 + i * 1.5) + '" cy="' + (y - 3) + '" r="5" fill="' + petal + '" opacity=".82"/>';
    }
    buds += '<circle cx="50" cy="16" r="5.5" fill="' + petal + '"/>';
    return svgWrap(
      '<path d="M50 128 C 49 100 50 76 50 24" fill="none" stroke="' + GREENS[1] +
      '" stroke-width="4.5" stroke-linecap="round"/>' + leaves() + buds
    );
  }

  function grassTuft() {
    return svgWrap(
      '<path d="M50 128 C 45 104 36 88 27 76" fill="none" stroke="' + GREENS[2] +
      '" stroke-width="5.5" stroke-linecap="round"/>' +
      '<path d="M52 128 C 50 100 49 82 48 62" fill="none" stroke="' + GREENS[0] +
      '" stroke-width="5.5" stroke-linecap="round"/>' +
      '<path d="M54 128 C 60 104 68 90 77 80" fill="none" stroke="' + GREENS[1] +
      '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M58 128 C 64 114 72 106 82 102" fill="none" stroke="' + GREENS[2] +
      '" stroke-width="4" stroke-linecap="round" opacity=".85"/>'
    );
  }

  function plantMarkup(index) {
    var type = index % 5;
    var petal = PETALS[Math.floor(rnd(index + 7) * PETALS.length)];
    var center = CENTERS[Math.floor(rnd(index + 31) * CENTERS.length)];
    if (type === 1) return tulip(petal);
    if (type === 2) return lavender(petal);
    if (type === 3) return grassTuft();
    if (type === 4) return flowerSmall(petal, center);
    return flowerRound(petal, center);
  }

  function createPlant(index) {
    var row = index % 2; // 0 = 后排，1 = 前排
    var col = Math.floor(index / 2); // 每排 10 株
    var jitter = (rnd(index + 3) - 0.5) * 2.4;
    var x = (col + 0.5) * 10 + (row ? 1.8 : -1.8) + jitter;
    var scale = (row ? 0.98 : 0.78) + rnd(index + 11) * 0.1;

    var el = document.createElement('div');
    el.className = 'plant ' + (row ? 'row-near' : 'row-far');
    el.style.left = Math.max(3, Math.min(97, x)) + '%';
    el.style.setProperty('--s', scale.toFixed(2));
    el.style.animationDelay = (-rnd(index + 5) * 4).toFixed(2) + 's';
    el.style.zIndex = String(row ? 4 : 2);
    el.innerHTML = plantMarkup(index);
    return el;
  }

  /* ---------- 花园同步 ---------- */

  function syncPlants(animateNew) {
    var target = Math.min(state.score, MAX_PLANTS);
    var i;

    while (plantEls.length > target) {
      var gone = plantEls.pop();
      gone.classList.add('fade-out');
      (function (node) {
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 340);
      })(gone);
    }

    for (i = plantEls.length; i < target; i++) {
      var el = createPlant(i);
      if (animateNew) {
        el.classList.add('pop-in');
        el.classList.add('sparkle');
        el.addEventListener('animationend', function (e) {
          if (e.animationName === 'plantPop') this.classList.remove('pop-in');
          if (e.animationName === 'sparkle') this.classList.remove('sparkle');
        });
      }
      plantsEl.appendChild(el);
      plantEls.push(el);
    }
  }

  function updateEmptyHint() {
    if (!emptyHint) {
      emptyHint = document.createElement('p');
      emptyHint.className = 'garden-empty';
      emptyHint.textContent = '这里还空空的，攒点分数就会长出花草啦';
      gardenEl.appendChild(emptyHint);
    }
    emptyHint.hidden = state.score > 0;
  }

  function tipFor(score) {
    if (score <= 0) return '花园还空着，先点一个左边的按钮吧';
    if (score < 5) return '小草芽冒出来了，继续听到更多话';
    if (score < 12) return '开花了！一分就会长出一株植物';
    if (score < MAX_PLANTS) return '花园越来越热闹了';
    return '花园开满啦，你听得真认真';
  }

  /* ---------- 交互反馈 ---------- */

  function flashScore(delta) {
    var float = document.createElement('span');
    float.className = 'score-float ' + (delta >= 0 ? 'up' : 'down');
    float.textContent = (delta >= 0 ? '+' : '−') + Math.abs(delta);
    scorePill.appendChild(float);
    setTimeout(function () {
      if (float.parentNode) float.parentNode.removeChild(float);
    }, 1050);
  }

  function bumpPill() {
    scorePill.classList.remove('bump');
    void scorePill.offsetWidth;
    scorePill.classList.add('bump');
  }

  function render(options) {
    scoreValue.textContent = String(state.score);
    scoreTip.textContent = tipFor(state.score);
    undoBtn.disabled = state.history.length === 0;
    syncPlants(options && options.animateNew);
    updateEmptyHint();
  }

  function applyDelta(delta) {
    if (delta < 0 && state.score <= 0) {
      flashScore(0);
      scoreTip.textContent = '分数已经到 0 啦，攒回来再继续';
      return;
    }

    var before = state.score;
    state.score = Math.max(0, before + delta);
    state.history.push({ prev: before });
    if (state.history.length > 50) state.history.shift();

    scoreValue.classList.toggle('is-down', delta < 0);
    setTimeout(function () {
      scoreValue.classList.remove('is-down');
    }, 700);

    flashScore(delta);
    bumpPill();
    save();
    render({ animateNew: delta > 0 });
  }

  function undo() {
    if (!state.history.length) return;
    var last = state.history.pop();
    state.score = Math.max(0, last.prev);
    save();
    render({ animateNew: false });
  }

  function reset() {
    state.score = 0;
    state.history = [];
    save();
    render({ animateNew: false });
  }

  /* ---------- 启动 ---------- */

  document.querySelectorAll('.score-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.remove('ping');
      void btn.offsetWidth;
      btn.classList.add('ping');
      applyDelta(Number(btn.dataset.delta));
    });
    btn.addEventListener('animationend', function (e) {
      if (e.animationName === 'btnPing') btn.classList.remove('ping');
    });
  });

  undoBtn.addEventListener('click', undo);
  resetBtn.addEventListener('click', reset);

  load();
  render({ animateNew: false });
})();
