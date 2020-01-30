'use strict';

var app = angular.module('applyMyRideApp');

angular.module('applyMyRideApp')
  .controller('AdminController', ['$scope', '$http', 'AuthService',
    function ($scope, $http, AuthService) {

      if (!AuthService.isLoggedIn()) {
        AuthService.redirectToLogin("/admin");
      }

      var PACE_OPTIONS = ["slow", "medium", "fast"];
      var PRIORITY_OPTIONS = ["TIME", "TRANSFERS", "WALKING"];
      var MODE_OPTIONS = ["mode_transit", "mode_walk", "mode_bicycle", "mode_park_transit", "mode_bicycle_transit"];

      // Get JSON
      $scope.change = function() {
        $http.get(getUrl()).then(function(resp) {
          $scope.config = [];
          angular.forEach(resp.data, function(value, key) {
            var d = {key: key, value: value, type: "text"} // default is text

            angular.forEach([PACE_OPTIONS, PRIORITY_OPTIONS, MODE_OPTIONS], function(opt) {
              if (opt.indexOf(d.value) >= 0) {
                d.type = "select";
                d.options = opt;
              }
            })

            if(d.value == "true" || d.value == "false") {
              d.type = "checkbox";
            }

            else if (d.key == "includeRoutes" || d.key == "excludeRoutes") {
              d.pattern = /^(\w|,\s*)*$/
              d.hint = "Comma separated list of route ids, i.e. 15,15L"
            }

            else if (d.key == "defaultPosition") {
              d.pattern = /^(-)?\d+\.\d+,\s*(-)?\d+\.\d+$/
              d.hint = "Latitude/longitude pair, i.e. 39.7392, -104.9903"
            }

            // number
            else if(d.value != "" && !isNaN(d.value)) {
              d.type = "number";
              d.value = Number(d.value);
              d.step = d.value.toString().split(".").length > 1 ? "0.1" : "1";
            }

            $scope.config.push(d);
          });
        }, function() {
          console.log("Error getting data")
        });
      }

      $scope.save = function() {
        var alert = jQuery("#alert");
        var data = {};
        angular.forEach($scope.config, function(item) {
          data[item.key] = item.value;
        });
        $http.post(getUrl(), {'data': data}).then(function() {
          alert.fadeIn(500);
          alert.fadeOut(500);
        }, function() {
          console.log("Error saving data");
        });
      }

      function getUrl() {
        if ($scope.configType === 'internal')
          return '/api/v1/internal/defaults';
        else if ($scope.configType === 'external')
          return '/api/v1/external/defaults';
      }

    }]);
