'use strict';

var app = angular.module('applyMyRideApp');

angular.module('applyMyRideApp')
  .controller('LoginController', ['$scope', 'AuthService',
    function ($scope, AuthService) {

      $scope.submit = function() {
        if ($scope.username == "rtd" && $scope.password == "admin")
          AuthService.setLoggedIn();
        else
          alert("Invalid username and password!")
      }

    }]);
