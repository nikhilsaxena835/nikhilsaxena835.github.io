import { onRequestGet as __api_daily_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/daily.js"
import { onRequestGet as __api_discover_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/discover.js"
import { onRequestGet as __api_filters_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/filters.js"
import { onRequestGet as __api_hidden_gem_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/hidden-gem.js"
import { onRequestGet as __api_history_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/history.js"
import { onRequestPost as __api_interact_js_onRequestPost } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/interact.js"
import { onRequestGet as __api_stats_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/stats.js"
import { onRequestPost as __api_user_js_onRequestPost } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/user.js"
import { onRequestGet as __api_world_tour_js_onRequestGet } from "/home/nikhil-saxena/Documents/GitHub/nikhilsaxena835.github.io/functions/api/world-tour.js"

export const routes = [
    {
      routePath: "/api/daily",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_daily_js_onRequestGet],
    },
  {
      routePath: "/api/discover",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_discover_js_onRequestGet],
    },
  {
      routePath: "/api/filters",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_filters_js_onRequestGet],
    },
  {
      routePath: "/api/hidden-gem",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_hidden_gem_js_onRequestGet],
    },
  {
      routePath: "/api/history",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_history_js_onRequestGet],
    },
  {
      routePath: "/api/interact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_interact_js_onRequestPost],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_stats_js_onRequestGet],
    },
  {
      routePath: "/api/user",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_user_js_onRequestPost],
    },
  {
      routePath: "/api/world-tour",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_world_tour_js_onRequestGet],
    },
  ]