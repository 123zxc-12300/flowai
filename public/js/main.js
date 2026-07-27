// FlowAI 流智 — 通用脚本

// ============================
// 登录状态检测（所有页面共用）
// ============================
(function() {
  var token = localStorage.getItem('flowai_token');
  var user = null;
  try { user = JSON.parse(localStorage.getItem('flowai_user')); } catch(e) {}

  if (token && user) {
    // 把导航栏的"登录/注册"换成"进入工作台"
    var navLogin = document.getElementById('nav-login');
    var navRegister = document.getElementById('nav-register');
    if (navLogin) {
      navLogin.textContent = '进入工作台';
      navLogin.href = '/app/';
      navLogin.className = 'btn btn-outline';
    }
    if (navRegister) {
      navRegister.textContent = '👤 ' + (user.phone || '用户');
      navRegister.href = '/app/';
    }

    // Hero CTA 也换掉
    var heroActions = document.getElementById('hero-actions');
    if (heroActions) {
      heroActions.innerHTML =
        '<a href="/app/" class="btn btn-primary btn-lg">进入工作台 →</a>' +
        '<a href="#features" class="btn btn-ghost btn-lg">了解功能</a>';
    }
  }
})();

// ============================
// 导航栏滚动效果
// ============================
var header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// ============================
// 滚动淡入动画
// ============================
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(function(el) {
  observer.observe(el);
});

// ============================
// 移动端菜单
// ============================
document.addEventListener('click', function(e) {
  var nav = document.querySelector('.nav-links');
  if (nav && nav.classList.contains('open') &&
      !e.target.closest('.nav') &&
      !e.target.closest('.mobile-menu-btn')) {
    nav.classList.remove('open');
  }
});
