on.input.routes = function(data) {
  var router = router_lib.router;
  router.setMatchedPaths(data);
  router.setOnChangeHandler(function(uri, route) {
    if (route) {
      var ret = {out: {}};
      ret.out[route.path] = route;
      output(ret);
    } else {
      output({ error: new Error('URI was not matched') });
    }
  });
};
