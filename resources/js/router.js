var _routes = [];

function routerAdd(pattern, handler) {
  _routes.push({ pattern: pattern, handler: handler });
}

function routerNavigate(path) {
  window.location.hash = path;
}

function _handleRoute() {
  var hash = window.location.hash.replace(/^#/, '') || '/dashboard';
  for (var i = 0; i < _routes.length; i++) {
    var r = _routes[i];
    var paramNames = (r.pattern.match(/:[^/]+/g) || []).map(function(p) { return p.slice(1); });
    var regex = new RegExp('^' + r.pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
    var match = hash.match(regex);
    if (match) {
      var params = {};
      paramNames.forEach(function(name, idx) { params[name] = match[idx + 1]; });
      document.querySelectorAll('[data-route]').forEach(function(el) {
        var base = '/' + hash.split('/')[1];
        el.classList.toggle('nav-active', el.dataset.route === base);
      });
      r.handler(params);
      return;
    }
  }
  routerNavigate('/dashboard');
}

window.addEventListener('hashchange', _handleRoute);
var router = { add: routerAdd, navigate: routerNavigate, init: _handleRoute };
