output = function() {
  var router = router_lib.router;
  router.setMatchedPaths(input.routes);
  router.setOnChangeHandler(function(uri, route) {
    if (route) {
      var ret = {out: {}};
      ret.out[route.path] = route;
      cb(ret);
    } else {
      cb({ error: new Error('URI was not matched') });
    }
  });
};
