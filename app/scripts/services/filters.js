'use strict';


angular.module('applyMyRideApp')
.filter('free', function() {
  return function(input) {
    return input == '$0.00' ? "Free" : input;
  };
})
.filter('secondsToDateTime', [function(){
  // convert seconds to a date -- use date filter for further formatting of the time tomponent
  return function(seconds){
    return new Date(1970,0,1).setSeconds(seconds);
  };
}])
.filter('secondsToHumanTime', [function(){
  return function(seconds){
    return moment.duration(seconds, 'seconds').humanize();
  };
}])
.filter('rtAbbrev', [function(){
  return function(route){
    if (!route) {
      return '';
    }
    return route
        .replace(/Route$/, 'Rt')
        .replace(/Drive$/, 'Dr')
        .replace(/Street$/, 'St')
        .replace(/Avenue$/, 'Ave')
        .replace(/Boulevard$/, 'Blvd');
  }
}])
.filter('departType', [function(){
  return function(departType){
    if (!departType) {
      return '';
    }
    if(departType == 'asap')
        return 'Depart now'
    if(departType == 'depart')
      return 'Depart after'
    if(departType == 'arrive')
      return 'Arrive by'
    return '';
  }
}])
.filter('travelTime', [function(){
  //return human readable travel time from seconds
  function minutes(seconds){
    var time = Math.round(seconds / 60);
    if(time > 1){
      return ''+ time + ' minutes';
    }else{
      return 'less than 1 minute';
    }
  }
  function hours(seconds){
    var time = Math.floor(seconds /3600);
    if(time > 1){
      return ''+ time + ' hours';
    }else{
      return ''+ time + ' hour';
    }
  }
  return function(seconds){	
    var time;
    if(seconds == 0){
      time = '0 min';
    }else if(seconds < 90){
      time = '1 min';
    }else if(seconds < 3600){ //less than an hour
      time = minutes(seconds);
    }else{
      time = hours(seconds);
      seconds = seconds - (parseInt(time) *3600);
      time += ' ' + minutes(seconds);
    }
    return time;
  }
}])
.filter('distance', [function(){
  //return human readable distance when provided feet
  return function(meters){
    var feet = meters * 3.28084;
    if(feet < (5280 / 4)) {
      return Math.round(feet) + ' feet';
    }else{
      //round to tenth of a mile
      //5280 ft per mile
      return '' + Math.round( (feet/5280) * 100 )/ 100 + ' miles';
    }
  };
}]).filter('stopId', [function(){
  //return human readable distance when provided feet
  return function(id){
    //strip anything to the left of the :
    //ex 1:233434 returns 233434
    if(!id){
      return '';
    }
    return ', Stop ' + id.replace(/.*:/, '');
  };
}]).filter('stopCount', [function(){
  //return human readable distance when provided feet
  return function(leg){
    if(leg.mode === 'WAIT')
        return '';
    var stopCount = Math.abs( leg.to.stopIndex - leg.from.stopIndex) - 1;
    if(stopCount === 0){
      return '';
    }
    if(stopCount == 1)
      return ''+stopCount+' Stop';
    return ''+stopCount+' Stops';
  };
}]).filter('orEmpty', [function(){
  //return string or empty string
  return function (s){ 
    return s || '';
  }
}]).filter('placeLabel', [function(){
  return function(placeDetails){

    var prefix = '';

    if(!placeDetails)
        return prefix;

    if(placeDetails.stop_code && (!placeDetails.formatted_address || placeDetails.formatted_address.indexOf(placeDetails.stop_code) == -1))
        prefix =  'Stop # ' + placeDetails.stop_code + ' - '

    if(placeDetails.formatted_address && placeDetails.formatted_address.indexOf(placeDetails.name) > - 1)
      return prefix + placeDetails.formatted_address;

    if(placeDetails.name && placeDetails.formatted_address)
      return prefix + placeDetails.name + ', ' + placeDetails.formatted_address;

    if(placeDetails.name)
      return prefix + placeDetails.name

    return  prefix + placeDetails.formatted_address;

  };
}]);

