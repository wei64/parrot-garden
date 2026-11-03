const REACTIONS = {
  happy:     { text: '继续保持！',        action: 'happy',     hold: 2400, sparks: ['💛', '✨', '💛', '✨', '💛'] },
  sad:       { text: '深呼吸，平静下来',  action: 'sad',       hold: 3400 },
  angry:     { text: '跳几下，平静下来',  action: 'angry',     hold: 2900 },
  scared:    { text: '勇敢一点',          action: 'scared',    hold: 2800, sparks: ['✨', '⭐', '✨', '⭐'] },
  surprised: { text: '',                  action: 'surprised', hold: 1800 }
};

const person = document.getElementById('person');
const bubble = document.getElementById('bubble');
const surpriseMark = document.getElementById('surpriseMark');
let timers = [];

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}
function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function clearSparks() {
  person.querySelectorAll('.spark').forEach((s) => s.remove());
}

function resetPerson() {
  person.className = 'person';
  bubble.classList.remove('show');
  bubble.textContent = '';
  surpriseMark.classList.remove('pop');
}

function makeSparks(emojis) {
  emojis.forEach((emoji, i) => {
    const s = document.createElement('span');
    s.className = 'spark ' + (i % 2 ? 'from-right' : 'from-left');
    s.textContent = emoji;
    s.style.bottom = (58 + (i % 3) * 6) + '%';
    s.style.fontSize = (14 + Math.random() * 10) + 'px';
    s.style.animationDelay = (i * 0.09) + 's';
    person.appendChild(s);
    setTimeout(() => s.remove(), 1900);
  });
}

function play(type) {
  const reaction = REACTIONS[type];
  if (!reaction) return;

  clearTimers();
  resetPerson();
  clearSparks();

  // 先切换表情，再触发动作动画，保证重复点击也能重新播放
  person.className = 'person mood-' + type;
  void person.offsetWidth;
  person.classList.add('act-' + reaction.action);

  if (reaction.text) {
    bubble.textContent = reaction.text;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.classList.add('show');
  } else {
    bubble.textContent = '';
    bubble.classList.remove('show');
    surpriseMark.classList.remove('pop');
    void surpriseMark.offsetWidth;
    surpriseMark.classList.add('pop');
  }

  if (reaction.sparks) makeSparks(reaction.sparks);

  const star = document.querySelector('.star[data-emotion="' + type + '"]');
  if (star) star.classList.add('on');

  later(resetPerson, reaction.hold);
}

document.querySelectorAll('.emotion').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.classList.remove('picked');
    void btn.offsetWidth;
    btn.classList.add('picked');
    play(btn.dataset.emotion);
  });
  btn.addEventListener('animationend', (e) => {
    if (e.animationName === 'picked') btn.classList.remove('picked');
  });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  clearTimers();
  resetPerson();
  clearSparks();
  document.querySelectorAll('.star').forEach((s) => s.classList.remove('on'));
});
