class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    
    window.addEventListener('popstate', () => {
      this.handleRoute();
    });
  }

  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  async handleRoute() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    for (const [route, handler] of Object.entries(this.routes)) {
      const match = this.matchRoute(route, path);
      if (match) {
        this.currentRoute = route;
        await handler(match.params, params);
        return;
      }
    }
    
    if (this.routes['/404']) {
      await this.routes['/404']();
    }
  }

  matchRoute(route, path) {
    const routeParts = route.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        return null;
      }
    }
    
    return { params };
  }
}

export const router = new Router();
