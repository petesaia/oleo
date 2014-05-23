// https://developers.google.com/google-apps/spreadsheets/
oleo.service('spreadsheetService', ['$http', '$q', 'identity', 'authService', function($http, $q, identity, auth) {
  var xml = this.xml = {
    feedWrap: function(key, worksheet, entries) {
      var xml = "";
      xml += '<feed xmlns="http://www.w3.org/2005/Atom" ';
      xml += 'xmlns:batch="http://schemas.google.com/gdata/batch" xmlns:gs="http://schemas.google.com/spreadsheets/2006">' + "\n";
      xml += '  <id>https://spreadsheets.google.com/feeds/cells/'+key+'/'+worksheet+'/private/full</id>' + "\n";
      xml += entries;
      xml += '</feed>';
      return xml;
    },
    batchEntry: function(key, worksheet, row, col, data) {
      var xml = "";
      xml += '  <entry>' + "\n";
      xml += '    <batch:id>'+uid()+'</batch:id>' + "\n";
      xml += '    <batch:operation type="update"/>' + "\n";
      xml += '    <id>https://spreadsheets.google.com/feeds/cells/'+key+'/'+worksheet+'/private/full/R'+row+'C'+col+'</id>' + "\n";
      xml += '    <link rel="edit" type="application/atom+xml" ';
      xml += 'href="https://spreadsheets.google.com/feeds/cells/'+key+'/'+worksheet+'/private/full/R'+row+'C'+col+'"/>' + "\n";
      xml += '    <gs:cell row="'+row+'" col="'+col+'" inputValue="'+data+'"/>' + "\n";
      xml += '  </entry>' + "\n";
      return xml;
    }
  };

  // For returning spreadsheet data.
  // GET
  var cellsEndpoint = this.cellsEndpoint = function(urlObj) {
    return "https://spreadsheets.google.com/feeds/cells/"+
        urlObj.key+"/"+urlObj.worksheet+"/private/full"
    ;
  };

  // For updating and inserting a row. Requires auth.
  // POST
  this.feedEndpoint = function(urlObj) {
    return "https://spreadsheets.google.com/feeds/list/"+
        urlObj.key+"/"+urlObj.worksheet+"/private/full"
    ;
  };

  // For generating a unique id for every entry.
  var uid = this.uid = (function() {
    var id = 0;
    return function() {
      if (arguments[0] === 0) {
        id = 0;
      }
      return id++;
    };
  })();


  // Parse a google spreadsheet url and return a "url object".
  // Returns false if not a propery spreadsheet url.
  // https://developers.google.com/gdata/samples/spreadsheet_sample
  this.parseUrl = function(url) {
    var matches = [],
        urlObj = {};
    if (typeof url !== "string") {
      throw new Error("Invalid url.");
    }
    matches = url.match(/^https:\/\/.*google.com.*\/d\/([^/]+).*$/i);
    if (!matches || matches.length < 2) {
      throw new Error("Invalid url.");
    }
    urlObj.key = matches[1];
    matches = url.match(/gid=([^/]+)/i);
    if (matches && matches.length > 1) {
      urlObj.worksheet = matches[1];
    } else {
      urlObj.worksheet = "od6"; // First worksheet.
    }
    return urlObj;
  };

  // Retrieve a spreadsheet via the cells endpoint.
  this.retrieve = function(urlObj) {
    var deferred = $q.defer();
    auth.authorize(false).then(
      function() {
        if ("string" === typeof urlObj) {
          urlObj = this.parseUrl(urlObj);
        }
        this.request({
          token: auth.accessToken,
          method: "GET",
          url: cellsEndpoint(urlObj) + "?alt=json"
        }).then(
          function(res) {
            var cells;
            try {
              cells = this.cells(res.feed);
              deferred.resolve(cells);
            } catch(e) {
              deferred.reject(e);
            }
          }.bind(this),
          deferred.reject
        );
      }.bind(this),
      deferred.reject
    );
    return deferred.promise;
  };

  // Cells are an array of objects specifiying their positions. If the object doesn't
  // contain a row & col property then it will be placed in its matrix position.
  //
  // [
  //   [{ content: 'will be overridden' }, { content: 'i am second col first row' }],
  //   [{ content: 'second row' }, { content: 'rule breaker, first cell', row: 1, col: 1 }]
  // ]
  this.put = function(urlObj, cells) {
    var deferred = $q.defer();
    auth.authorize(false).then(
      function() {
        if ("string" === typeof urlObj) {
          urlObj = this.parseUrl(urlObj);
        }
        var feed = "";
        var entries = "";
        var rowIndex = 1;
        var colIndex;
        for (var row in cells) {
          colIndex = 1;
          for (var col in cells[row]) {
            entries += xml.batchEntry(
              urlObj.key,
              urlObj.worksheet,
              cells[row][col].row || rowIndex,
              cells[row][col].col || colIndex,
              cells[row][col].content
            );
            colIndex++;
          }
          rowIndex++;
        }
        feed += xml.feedWrap(urlObj.key, urlObj.worksheet, entries);
        this.request({
          token: auth.accessToken,
          method: "POST",
          url: cellsEndpoint(urlObj) + "/batch",
          content: feed,
          headers: {
            'Content-Type': 'application/atom+xml'
          }
        }).then(
          function(res) {
            if (res.toLowerCase().indexOf("reason='success'") > 0) {
              deferred.resolve(res);
            } else {
              deferred.reject(res);
            }
          },
          deferred.reject
        );
      }.bind(this),
      deferred.reject
    );
    return deferred.promise;
  };

  this.cells = function(feed) {
    var entries = feed.entry || [];
    var entry = null;
    var cells = [];
    var row = null;
    var col = null;
    var pRow = null;
    for (var i = 0; i < entries.length; ++i) {
      entry = entries[i];
      row = parseInt(entry.title.$t.replace(/[a-z]*/i, ''), 10) - 1;
      col = entry.title.$t.replace(/[0-9]*/i);
      if (pRow !== row) {
        cells[row] = [];
      }
      cells[row].push({
        pos: entry.title.$t,
        content: entry.content.$t
      });
      pRow = row;
    }
    return cells;
  };

  // Request the api.
  this.request = function(opts) {
    var deferred = $q.defer();
    if (!opts.url || !opts.method || !opts.token) {
      throw new Error("Url, Method, and Token are required for request.");
    }
    var xhr = new XMLHttpRequest();
    var config = {};
    config.url = opts.url;
    config.method = opts.method;
    config.headers = {
      'GData-Version': '3.0',
      'If-Match': '*'
    };
    if (opts.token) {
      config.headers.Authorization = "Bearer "+opts.token;
    }
    config.headers = angular.extend(config.headers, opts.headers || {});
    xhr.open(config.method, config.url, true);
    for (var header in config.headers) {
      xhr.setRequestHeader(header, config.headers[header]);
    }
    xhr.send(opts.content || null);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          var res;
          try {
            res = JSON.parse(xhr.responseText);
          } catch(e) {
            res = xhr.responseText;
          }
          deferred.resolve(res);
        } else {
          deferred.reject(xhr);
        }
      }
    };
    return deferred.promise;
  };
}]);
