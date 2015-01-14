state.router = null;
on.input.routes = function(data) {
  state.router = null;
  state.router = router_lib.router;
  state.router.setMatchedPaths(data);
  state.router.setOnChangeHandler(function(uri, route) {
    if (route) {
      var ret = {out: {}};
      ret.out[route.path] = route;
      output(ret);
    } else {
      output({ error: new Error('URI was not matched') });
    }
  });
  state.router.start();
};
