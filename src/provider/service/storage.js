oleo.service('storageService', ['storage', '$q', function (storage, $q) {
  this.get = function (key) {
    var deferred = $q.defer();
    storage.get(key, function(data) {
      deferred.resolve(data);
    });
    return deferred.promise;
  };
  this.put = function (key, data) {
    var deferred = $q.defer();
    var _data = {};
    _data[key] = data;
    storage.set(_data, deferred.resolve);
    return deferred.promise;
  };
}]);