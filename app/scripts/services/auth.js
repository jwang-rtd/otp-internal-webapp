'use strict';


angular.module('applyMyRideApp')
  .service('AuthService', ['$location', function($location) {
    
    var $loggedIn = false;
    var $afterLogin = "";
    
    var auth = {
      
      isLoggedIn: function() {
        return $loggedIn;
      },

      redirectToLogin: function(afterLogin) {
        $afterLogin = afterLogin;
        $location.path("/login")
      },

      setLoggedIn: function() {
        $loggedIn = true;
        if ($afterLogin && !($afterLogin === "")) {
          $location.path($afterLogin)
        }
      }

    }
    return auth;
}]);