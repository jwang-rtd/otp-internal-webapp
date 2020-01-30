'use strict';

var app = angular.module('applyMyRideApp');

angular.module('applyMyRideApp')
  .controller('NavbarController', ['$scope', '$location', 'flash', 'planService', 'deviceDetector', 'ipCookie', '$window',
    function ($scope, $location, flash, planService, deviceDetector, ipCookie, $window) {

      var input = document.createElement('input');
      input.setAttribute('type','date');
      var notADateValue = 'not-a-date';
      input.setAttribute('value', notADateValue);
      $scope.html5 = !(input.value === notADateValue);
      if ($window.navigator.userAgent.indexOf("Firefox/") != -1) {
        $scope.html5 = false;
      }
      planService.html5 = $scope.html5;
      $scope.mobile = deviceDetector.isMobile();
      planService.mobile = $scope.mobile;

      $scope.flash = flash;

    }]);

angular.module('applyMyRideApp').factory('flash', function($rootScope) {
  var currentMessage = '';

  $rootScope.$on('$routeChangeSuccess', function() {
    currentMessage = null;
  });

  return {
    setMessage: function(message) {
      //queue.push(message);
      currentMessage = message;
    },
    getMessage: function() {
      return currentMessage;
      currentMessage = null;
    }
  };
});