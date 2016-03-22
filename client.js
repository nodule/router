module.exports = {
  name: "client",
  ns: "router",
  description: "Client Side Router, to simplify usage outputs an object keyed by route",
  async: true,
  dependencies: {
    npm: {
      "router-lib": require('router-lib')
    }
  },
  phrases: {
    active: "Routing"
  },
  ports: {
    input: {
      routes: {
        title: "Routes",
        type: "array",
        async: true,
        fn: function __ROUTES__(data, x, source, state, input, output, router_lib) {
          var r = function() {
            state.router = null;
            state.router = router_lib.router;
            state.router.setMatchedPaths($.routes);
            state.router.setOnChangeHandler(function(uri, route) {
              if (route) {
                var ret = {
                  out: {}
                };
                ret.out[route.path] = $.create(route);
                output(ret);
              } else {
                output({
                  error: $.create(new Error('URI was not matched'))
                });
              }
            });
            state.router.start();
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      }
    },
    output: {
      error: {
        title: "Error",
        type: "Error"
      },
      out: {
        title: "Route",
        type: "object",
        additionalProperties: true
      }
    }
  },
  state: {
    router: null
  }
}