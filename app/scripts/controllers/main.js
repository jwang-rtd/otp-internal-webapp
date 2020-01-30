'use strict';

angular.module('applyMyRideApp')
    .controller('MainController', ['$scope', '$http','$routeParams' , 'mapLayerService', 'planService', 'LocationSearch', '$q', 'localStorageService', 'usSpinnerService','$location', '$timeout', '$modal', '$compile', '$filter', '$sce',
        function($scope, $http, $routeParams, mapLayerService, planService, LocationSearch, $q, localStorageService, usSpinnerService, $location, $timeout, $modal, $compile, $filter, $sce) {

            $scope.mapOptions = {
                zoom: 12,
                mapTypeControl: true,
                panControl: true,
                zoomControl: true,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            $scope.mapLayersById = {};

            $scope.showDiv = {};
            $scope.fromTimeType = 'asap';
            $scope.fromDate = moment().seconds(0).milliseconds(0).toDate();
            $scope.minDate = moment().seconds(0).milliseconds(0).toDate();
            $scope.fromTime = moment().seconds(0).milliseconds(0).toDate();
            $scope.submitDisabled = false;
            $scope.tabId = 0;
            $scope.resultsTabbed = [];
            $scope.waypoints = [];
            $scope.maxWaypoints = 4;

            planService.getSynonyms($http, $scope);

            planService.getBlacklist($http, $scope);

            planService.getDefaults($http, $scope);

            var placeMarkers = {
                from:new google.maps.Marker({
                    draggable: true,
                    position: $scope.defaultPosition,
                    icon: "http://maps.google.com/mapfiles/marker_greenA.png"
                }),
                to: new google.maps.Marker({
                    draggable: true,
                    position: $scope.defaultPosition,
                    icon: 'http://maps.google.com/mapfiles/markerB.png'
                })
            };
            google.maps.event.addListener(placeMarkers.from, 'dragend', function (event) {
                usSpinnerService.spin('spinner-1');
                reverseGeocodeMarker( placeMarkers.from, 'from' );
            });
            google.maps.event.addListener(placeMarkers.to, 'dragend', function (event) {
                usSpinnerService.spin('spinner-1');
                reverseGeocodeMarker( placeMarkers.to, 'to' );
            });
            var zoomMapEcho = true;

            function setMarker(latLng, waypointId, zoomMap) {

                var label, resetMarker = false;
                //setup the waypoint marker if it doesn't exist
                for(var i = 0; i < $scope.waypoints.length; i++){
                    if($scope.waypoints[i].id == waypointId){
                        label = i.toString();
                        if(i == 0){
                            waypointId = 'from';
                        }else if (i == $scope.waypoints.length - 1){
                            waypointId = 'to';
                        }else{
                            resetMarker = true;
                        }
                        break;
                    }
                }
                if(resetMarker && placeMarkers[waypointId]){
                    placeMarkers[waypointId].setMap(null);
                    google.maps.event.clearInstanceListeners( placeMarkers[ waypointId ] );
                    delete placeMarkers[waypointId];
                }
                if(undefined === placeMarkers[waypointId]){
                    placeMarkers[waypointId] = new google.maps.Marker({
                        label: {
                            text: label,
                            color: 'white',
                            fontSize: '16px'
                        },
                        draggable: true,
                        position: $scope.defaultPosition,
                        icon: 'http://maps.google.com/mapfiles/ms/icons/purple.png'
                    });
                    google.maps.event.addListener(placeMarkers[ waypointId ], 'dragend', function (event) {
                        usSpinnerService.spin('spinner-1');
                        reverseGeocodeMarker( placeMarkers[ waypointId ], waypointId );
                    });
                }
                //default zoomMap to true, unless explicit false
                zoomMap = (zoomMap===false) ? false : true;
                //set marker is called 2x when using map contextmenu. so noZoom is set 2x if called once
                placeMarkers[waypointId].setMap($scope.mainMap);
                //change marker location to match the user click
                placeMarkers[waypointId].setPosition(latLng);
                //don't do this if we are not supposed to zoom
                if( zoomMap && zoomMapEcho){
                    var bounds = new google.maps.LatLngBounds();
                    var markCount = 0;
                    angular.forEach(placeMarkers, function(marker, k){
                        if($scope.mainMap === marker.getMap()){
                            markCount +=1;
                            bounds.extend(marker.position);
                        }
                    });
                    $scope.mainMap.setCenter(bounds.getCenter());
                    $scope.mainMap.fitBounds(bounds);
                    if(1 == markCount){
                        $scope.mainMap.setZoom(12);
                    }
                }else if(!zoomMap){
                    //when no zoom runs, set echo to run 2nd time
                    zoomMapEcho = false;
                }else{
                    //clear both
                    zoomMapEcho = true;
                }

                $timeout(function() {
                    google.maps.event.trigger($scope.mainMap, 'resize');
                }, 200);

                return placeMarkers[waypointId];
            }

            function reverseGeocodeMarker( marker, waypointId ){
                //reverse-geocode the marker's lat/lng, use the response location as the to/from
                var markerPos = marker.getPosition();
                var latlng = '' + markerPos.lat() + ',' + markerPos.lng();

                // <!--RTD Key -->
                $http.get('https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyC1qo9HkufWGO0RzkBVmd70empQ9Kd0v_s&latlng='+latlng).

                // <!--Camsys Key -->
                //$http.get('https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAPaxQjNFbfOn2RVBiCqPydI4WuQtH62zw&latlng='+latlng).
                success(function(data){
                    //use the response lat/lng to update the marker's position (reflect what the server is thinking)
                    marker.setPosition( new google.maps.LatLng( data.results[0].geometry.location.lat, data.results[0].geometry.location.lng ) );
                    //set the to/from autocomplete fields to the response values
                    $scope.pauseAutocomplete = true;
                    $scope.place = data.results[0].formatted_address;
                    $scope.waypointId = waypointId;
                    $scope.poi = null;
                    //warn if beyond service area
                    $scope.checkServiceArea(data.results[0], data.results[0].formatted_address, waypointId, true);
                });
            }
            $scope.mainMapMenuCallback = $.noop;
            $scope.mainMapContextMenu = function(event) {
                //remove old menu, compile and attach a new menu, set menu position
                $scope.clearMainMapContextMenu();
                //$scope.intermediateLocations
                var html = '<div id="contextmenu-startstop">\
                             <div ng-repeat="waypoint in waypoints track by waypoint.id">\
                               <div class="row"><div class="col-xs-12">\
                                 <div class="btn btn-secondary" ng-click="mainMapMenuCallback( waypoint.id )">\
                                    <span ng-if="$first">\
                                        <i class="fa fa-map-marker" style="color:green"></i> Start\
                                    </span>\
                                    <span ng-if="$middle">\
                                   <i class="fa fa-map-marker" style="color:purple"></i> {{waypoint.name}}\
                                    </span>\
                                    <span ng-if="$last">\
                                        <i class="fa fa-map-marker" style="color:red"></i> End\
                                    </span>\
                                 </div>\
                               </div></div>\
                             </div>\
                         </div>';
                var content = $compile( html )($scope);
                $($scope.mainMap.getDiv()).append(content);
                $('#contextmenu-startstop').css('left', event.pixel.x );
                $('#contextmenu-startstop').css('top', event.pixel.y);
                //change the callback to
                $scope.mainMapMenuCallback = function(waypointId){
                    $scope.clearMainMapContextMenu();
                    usSpinnerService.spin('spinner-1');
                    var marker = setMarker(event.latLng, waypointId, false);
                    reverseGeocodeMarker(marker, waypointId);
                }
            }
            $scope.clearMainMapContextMenu = function(){
                $('#contextmenu-startstop').remove();
            }
            $scope.$watch('defaultPosition', function(n, k) {
                if(n != null && $scope.mainMap){
                    //center on denver
                    $scope.mainMap.setCenter($scope.defaultPosition, 13);
                    //set right click handler to open context menu and set start/end points
                    google.maps.event.addListener($scope.mainMap, "rightclick", $scope.mainMapContextMenu);
                    google.maps.event.addListener($scope.mainMap, "click", $scope.clearMainMapContextMenu);
                }
            });

            $scope.show = function($event){
                var index = $(event.target).parents('.timeline').attr('index');
                $scope.showDiv[index] = !$scope.showDiv[index];
            }

            $scope.specifyFromTimeType = function(fromTimeType){
                $scope.fromTimeType = fromTimeType;
                if(fromTimeType == 'asap'){
                    $scope.fromTime = moment().seconds(0).milliseconds(0).toDate();
                    $scope.fromDate = moment().seconds(0).milliseconds(0).toDate();
                } else {
                    // Force a refresh. Otherwise initial date takes wrong format.
                    $('#tp-date-simple').datepicker('setDate', $('#tp-date-simple').datepicker('getDate'));
                }
            }

            $scope.changeFromDate = function(fromDate) {
                $('#dateError').hide();
                $scope.fromDate = fromDate;
            }

            $scope.changeFromTime = function(fromTime) {
                $('#timeError').hide();
                $scope.fromTime = fromTime;
            }

            // If user specifies time, update distance = time * rate.
            $scope.changeMaxWalkTime = function(maxWalkTime) {
                var miles = (maxWalkTime / 60.0) * $scope.getWalkRate($scope.maxWalkPace);
                $scope.maxWalkDistance = $scope.roundDistance(miles);
            }

            // If user specifies distance, update time = distance / rate.
            $scope.changeMaxWalkDistance = function(maxWalkDistance) {
                var hours = (maxWalkDistance / $scope.getWalkRate($scope.maxWalkPace));
                $scope.maxWalkTime = Math.round(hours * 60.0);
            }

            // If user specifies rate, update distance = time * rate.
            $scope.changeMaxWalkPace = function(maxWalkPace) {
                var miles = ($scope.maxWalkTime / 60.0) * $scope.getWalkRate(maxWalkPace);
                $scope.maxWalkDistance = $scope.roundDistance(miles);
            }

            $scope.getWalkRate = function(walkPace) {
                if (walkPace == 'slow')
                    return 1;
                else if (walkPace == 'medium')
                    return 2;
                else if (walkPace == 'fast')
                    return 3;
                else
                    return 1;
            }

            // Round distance to 2 decimal places.
            $scope.roundDistance = function(distance) {
                return Math.round(distance * 100) / 100;
            }

            // If user specifies time, update distance = time * rate.
            $scope.changeMaxBikeTime = function(maxBikeTime) {
                var miles = (maxBikeTime / 60.0) * $scope.getBikeRate($scope.maxBikePace);
                var distance = $scope.roundDistance(miles);
                if (distance != $scope.maxBikeDistance) {
                    $scope.maxBikeDistance = distance;
                }
            }

            // If user specifies distance, update time = distance / rate.
            $scope.changeMaxBikeDistance = function(maxBikeDistance) {
                var hours = (maxBikeDistance / $scope.getBikeRate($scope.maxBikePace));
                var minutes = Math.round(hours * 60.0);
                if (minutes != $scope.maxBikeTime) {
                    $scope.maxBikeTime = minutes;
                }
            }

            // If user specifies rate, update distance = time * rate.
            $scope.changeMaxBikePace = function(maxBikePace) {
                var miles = ($scope.maxBikeTime / 60.0) * $scope.getBikeRate(maxBikePace);
                var distance = $scope.roundDistance(miles);
                if (distance != $scope.maxBikeDistance) {
                    $scope.maxBikeDistance = distance;
                }
            }

            $scope.getBikeRate = function(bikePace) {
                if (bikePace == 'slow')
                    return 8;
                else if (bikePace == 'medium')
                    return 12;
                else if (bikePace == 'fast')
                    return 16;
                else
                    return 8;
            }

            /**
             * @param showNewPage If true, show a new itinerary tab with the results.
             *                    If false, update an existing itinerary.
             */
            $scope.planTrip = function($http, showNewItinerary) {
                usSpinnerService.spin('spinner-1');
                $scope.tripPlanningPrefsObject = planService.copyTripPlanningPrefs($scope);
                planService.prepareItineraryRequestObject($scope);
                var promise = planService.postItineraryRequest($http);
                promise.success(function(result) {
                    usSpinnerService.stop('spinner-1');

                    var originalLength = result.itineraries.length;
                    var i = result.itineraries.length;
                    var errors = [];
                    var itinerariesStartingBeforeNowCount = 0;

                    if (result['trip_warn_message'] != null) {
                        $scope.showPlanWarnMessage = true;
                        $scope.planWarnMessage = result['trip_warn_message'];
                    } else {
                        $scope.showPlanWarnMessage = false;
                    }

                    while (i--) {
                        var itinerary = result.itineraries[i];

                        if(itinerary.server_status != 200){
                            errors.push("Your search for " + itinerary.mode.name.toLowerCase() + " trips had a problem. " + itinerary.server_message);
                            result.itineraries.splice(i, 1);
                        }else if (moment(new Date()).diff(moment(itinerary.start_time)) / 1000 > 90) {
                            itinerariesStartingBeforeNowCount++;
                        }
                    }

                    var result_had_errors = false;

                    if(result.errors){

                        $scope.responseErrors = result.errors;

                        var message = "";

                        if(result.errors.mode_transit != undefined && result.errors.mode_transit.length > 0) {
                            message = message + "There was a problem searching by transit: "+result.errors.mode_transit+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_bicycle_transit != undefined && result.errors.mode_bicycle_transit.length > 0) {
                            message = message + "There was a problem searching bike to transit: "+result.errors.mode_bicycle_transit+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_park_transit != undefined && result.errors.mode_park_transit.length > 0) {
                            message = message + "There was a problem searching for park and ride: "+result.errors.mode_park_transit+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_bike_park_transit != undefined && result.errors.mode_bike_park_transit.length > 0) {
                            message = message + "There was a problem searching by bike to parking to transit: "+result.errors.mode_bike_park_transit+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_rail != undefined && result.errors.mode_rail.length > 0) {
                            message = message + "There was a problem searching by rail: "+result.errors.mode_rail+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_bus != undefined && result.errors.mode_bus.length > 0) {
                            message = message + "There was a problem searching by bus: "+result.errors.mode_bus+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_walk != undefined && result.errors.mode_walk.length > 0) {
                            message = message + "There was a problem searching by walk: "+result.errors.mode_walk+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_car != undefined && result.errors.mode_car.length > 0) {
                            message = message + "There was a problem searching by car: "+result.errors.mode_car+"<br/>";
                            result_had_errors = true;
                        }
                        if(result.errors.mode_bicycle != undefined && result.errors.mode_bicycle.length > 0) {
                            message = message + "There was a problem searching by bike: "+result.errors.mode_bicycle+"<br/>";
                            result_had_errors = true;
                        }

                        if(result_had_errors)
                        {
                            bootbox.alert(message);
                        }
                    }

                    if((result.itineraries.length < 1 && !result.errors) || itinerariesStartingBeforeNowCount > 0 && result.errors.length > 0){
                        if(itinerariesStartingBeforeNowCount == originalLength && originalLength != 0){
                            bootbox.alert("WARNING: We are showing you trips that will connect your destination. No trips were found that arrive by your specified time.  Please try again for a later time.");
                        }else{
                            bootbox.alert("No trips were found meeting your search criteria, please modify your search and try again.");
                            return;
                        }
                    }else if(result.itineraries.length < 1 && result.errors) {
                        return;
                    }

                    angular.forEach(result.itineraries, function(itinerary, index) {
                        itinerary.origin_in_callnride = result.origin_in_callnride;
                        itinerary.destination_in_callnride = result.destination_in_callnride;
                        itinerary.origin_callnride = result.origin_callnride;
                        itinerary.destination_callnride = result.destination_callnride;
                        planService.setBusRailDepartures(itinerary);
                        planService.setItineraryDescriptions(itinerary, result);
                        if(itinerary.json_legs){
                            angular.forEach(itinerary.json_legs, function(leg, index) {
                                planService.setRealTimeData(leg);
                                planService.setItineraryLegDescriptions(leg);
                                angular.forEach(leg.steps, function(step, index) {
                                    planService.setWalkingDescriptions(step);
                                });
                                if(index > 0){
                                    var previousLeg = itinerary.json_legs[index - 1];
                                    if((leg.startTime - previousLeg.endTime) > 1000)
                                        leg.waitTimeDesc = "Transfer wait time: " + humanizeDuration(leg.startTime - previousLeg.endTime,  { units: ["minutes"], round: true });
                                }
                            });
                        }
                    });
                    planService.searchResults = result;
                    if (showNewItinerary) {
                        //store a timestamp of when this was created for ID, and name to be displayed in the tab
                        var nameParts = [];
                        //to ensure html escaping for nameParts, but not the delimiter (the right-arrow char &rarr;) use $sce to process parts
                        //coalesce name, address (if named use that, otherwise street+route)
                        nameParts.push( $sce.getTrustedHtml(
                            planService.waypoints[0].locationDetails.name ||
                            ($filter('orEmpty')(planService.waypoints[0].locationDetails.street_number) +' '+ $filter('rtAbbrev')(planService.waypoints[0].locationDetails.route))
                        ));
                        nameParts.push( $sce.getTrustedHtml(
                            planService.waypoints[planService.waypoints.length - 1].locationDetails.name || ($filter('orEmpty')(planService.waypoints[planService.waypoints.length - 1].locationDetails.street_number) +' '+ $filter('rtAbbrev')(planService.waypoints[planService.waypoints.length - 1].locationDetails.route))
                        ));

                        $scope.resultsTabbed.push( {
                            id: new Date().valueOf(),
                            name: $sce.trustAsHtml( nameParts.join(' &#8680; ') )
                        });
                    } else {
                        $scope.updateExistingItinerary(result);
                    }
                }).
                error(function(result) {
                    bootbox.alert("An error occured on the server, please retry your search or try again later.");
                    usSpinnerService.stop('spinner-1');
                })
            }

            $scope.planMultiLegTrip = function($http, showNewItinerary) {
                planService.searchResults = [];
                var nameParts = [];
                var legIndex, toLegIndex, fromLegIndex, hasMoreLegs, legCount, addLegResult, fromDateTime;
                usSpinnerService.spin('spinner-1');
                //if type is arrive: process in reverse order with inverse operations
                if('arrive' == $scope.fromTimeType){
                    legIndex = $scope.waypoints.length -1;
                    hasMoreLegs = function(){ legIndex--; return 0 < legIndex; };
                    fromLegIndex = function(){ return legIndex-1; };
                    toLegIndex = function(){ return legIndex; };
                    addLegResult = function(result){
                        nameParts.unshift( $sce.getTrustedHtml(
                            planService.waypoints[ legIndex ].locationDetails.name || ($filter('orEmpty')(planService.waypoints[ legIndex ].locationDetails.street_number) +' '+ $filter('rtAbbrev')(planService.waypoints[ legIndex ].locationDetails.route))
                        ));
                        planService.searchResults.unshift(result);
                    };
                    fromDateTime = function(){
                        var layoverTime, fromDate;
                        layoverTime = $scope.waypoints[ toLegIndex() ].layoverTime;
                        if(planService.searchResults.length > 0){
                            fromDate = new Date( planService.searchResults[0].itineraries[0].start_time  )
                            fromDate = moment(fromDate).subtract(layoverTime, 'minutes').toDate();
                        }else{
                            fromDate = $scope.fromDate;
                            if(typeof fromDate == 'string')
                                fromDate = new Date(fromDate);
                            fromDate.setHours($scope.fromTime.getHours());
                            fromDate.setMinutes($scope.fromTime.getMinutes());
                        }
                        return fromDate;
                    };
                }else{
                    legIndex = 0;
                    legCount = $scope.waypoints.length -1;
                    hasMoreLegs = function(){ legIndex++; return legIndex < legCount; };
                    fromLegIndex = function(){ return legIndex; };
                    toLegIndex = function(){ return legIndex +1; };
                    addLegResult = function(result){
                        nameParts.push( $sce.getTrustedHtml(
                            planService.waypoints[ legIndex ].locationDetails.name || ($filter('orEmpty')(planService.waypoints[ legIndex ].locationDetails.street_number) +' '+ $filter('rtAbbrev')(planService.waypoints[ legIndex ].locationDetails.route))
                        ));
                        planService.searchResults.push(result);
                    };
                    fromDateTime = function(){
                        var layoverTime, fromDate;

                        layoverTime = $scope.waypoints[ fromLegIndex() ].layoverTime;
                        if(planService.searchResults.length > 0){
                            fromDate = new Date( planService.searchResults[ planService.searchResults.length -1 ].itineraries[0].end_time  );
                            fromDate.setMinutes(fromDate.getMinutes()+ layoverTime);
                        }else{
                            fromDate = $scope.fromDate;
                            if(typeof fromDate == 'string')
                                fromDate = new Date(fromDate);
                            fromDate.setHours($scope.fromTime.getHours());
                            fromDate.setMinutes($scope.fromTime.getMinutes());
                        }
                        return fromDate;
                    };
                }
                $scope.showMultiPlanWarnMessage = false;
                //use the functions defined above to plan each leg. first call to planLeg is automatic, next depends on what hasMoreLegs returns
                var planLeg = function()
                {
                    var reverseOrder = 'arrive' == $scope.fromTimeType;
                    planService.fromDate = fromDateTime();
                    planService.fromTime = fromDateTime();
                    planService.prepareItineraryRequestObject($scope, legIndex, reverseOrder);

                    var promise = planService.postItineraryRequest($http);
                    promise.success(function(result) {
                        if(result.itineraries.length < 1 || result.itineraries[0].server_status != 200 ){
                            bootbox.alert("No trips found for your search.");
                            usSpinnerService.stop('spinner-1');
                            return;
                        }
                        if (result['trip_warn_message'] != null) {
                            $scope.showMultiPlanWarnMessage = true;
                            $scope.multiPlanWarnMessage = result['trip_warn_message'];
                        }
                        angular.forEach(result.itineraries, function(itinerary, index) {
                            itinerary.origin_in_callnride = result.origin_in_callnride;
                            itinerary.destination_in_callnride = result.destination_in_callnride;
                            itinerary.origin_callnride = result.origin_callnride;
                            itinerary.destination_callnride = result.destination_callnride;
                            planService.setItineraryDescriptions(itinerary, result);
                            if(itinerary.json_legs){
                                angular.forEach(itinerary.json_legs, function(leg, index) {
                                    planService.setRealTimeData(leg);
                                    planService.setItineraryLegDescriptions(leg);
                                    angular.forEach(leg.steps, function(step, index) {
                                        planService.setWalkingDescriptions(step);
                                    });
                                });
                            }
                        });
                        //add the result to planService.searchResults
                        addLegResult( result );
                        //if there are more legs, plan them
                        if ( hasMoreLegs() ) {
                            planLeg();
                        }else{
                            //no more legs, stop spinner and append the multi-leg itinerary tab
                            usSpinnerService.stop('spinner-1');
                            if(showNewItinerary){
                                //store a timestamp of when this was created for ID, and name to be displayed in the tab
                                //to ensure html escaping for nameParts, but not the delimiter (the right-arrow char &rarr;) use $sce to process parts
                                //coalesce name, address (if named use that, otherwise street+route)
                                if('arrive' == $scope.fromTimeType){
                                    nameParts.unshift( $sce.getTrustedHtml(
                                        planService.waypoints[0].locationDetails.name ||
                                        ($filter('orEmpty')($scope.waypoints[0].locationDetails.street_number) +' '+ $filter('rtAbbrev')($scope.waypoints[0].locationDetails.route))
                                    ));
                                }else{
                                    nameParts.push( $sce.getTrustedHtml(
                                        $scope.waypoints[$scope.waypoints.length - 1].locationDetails.name || ($filter('orEmpty')($scope.waypoints[$scope.waypoints.length - 1].locationDetails.street_number) +' '+ $filter('rtAbbrev')($scope.waypoints[$scope.waypoints.length - 1].locationDetails.route))
                                    ));
                                }
                                $scope.resultsTabbed.push( {
                                    id: new Date().valueOf(),
                                    name: $sce.trustAsHtml( nameParts.join(' &#8680; ') ),
                                    multileg: true
                                });
                            } else {
                                $scope.updateExistingItinerary(planService.searchResults);
                            }
                        }
                    }).
                    error(function(result) {
                        bootbox.alert("An error occured on the server, please retry your search or try again later.");
                        usSpinnerService.stop('spinner-1');
                    })
                }
                //plan the first leg
                planLeg();
                //end multileg
            }

            $scope.updateExistingItinerary = function(result) {
                var activeTabId = $('.active .tripResultsTab')[0].id;
                var activeTabIndex = activeTabId.replace('itinerary-tab-', '');
                if (activeTabIndex && !isNaN(activeTabIndex)) {
                    $scope.$broadcast('event.itinerary.updateItinerary' + activeTabIndex, result);
                }
            }

            $scope.clickPlanTripTab = function(e) {
                $timeout(function() {
                    google.maps.event.trigger($scope.mainMap, 'resize');
                }, 200);

                e.preventDefault();
                $scope.resetForm();
            }

            $scope.clickTripItinerariesTab = function(e) {
                e.preventDefault();
            }

            $scope.closeTripItinerariesTab = function(e) {
                e.stopPropagation();
                e.preventDefault();
                var confirmFunction = function(result) {
                    var closeIcon = e.currentTarget;
                    if (result == true) {
                        $scope.selectFirstTab(); //first select a tab, so bootstrap doesn't
                        //get the tab id we're looking for, then find its index in resultsTabbed, then remove that elemnt
                        var resultsTabbedId = $(closeIcon).prev('button').data('target');
                        var resultsTabbedIndex = -1;
                        for(var i = 0; i < $scope.resultsTabbed.length; i++){
                            if(resultsTabbedId.indexOf($scope.resultsTabbed[i].id) > -1){
                                $scope.resultsTabbed.splice(i, 1);
                                $scope.resetForm();
                                break;
                            }
                        }
                    }
                };
                bootbox.confirm({
                    message: 'Are you sure you want to close this tab?',
                    buttons: {
                        'cancel': {
                            label: 'No'
                        },
                        'confirm': {
                            label: 'Yes'
                        }
                    },
                    callback: confirmFunction
                });
                return false;
            }

            $scope.selectFirstTab = function() {
                $('.nav-tabs a:first').tab('show');
                $timeout(function() {
                    google.maps.event.trigger($scope.mainMap, 'resize');
                }, 200);
            }

            /**
             * @param validate Flag indicating whether to validate the form before submitting.
             */
            $scope.submitForm = function(validate) {
                if (!validate || $scope.validateForm()) {
                    planService.fromTimeType = $scope.fromTimeType;
                    planService.fromDate = $scope.fromDate;
                    planService.fromTime = $scope.fromTime;
                    $scope.initialFromDate = $scope.fromDate;
                    $scope.initialFromTime = $scope.fromTime;
                    planService.prefer = $scope.priority;
                    planService.fromTimeType = $scope.fromTimeType;
                    if($scope.fromTimeType == 'asap'){
                        $scope.fromTime = moment().seconds(0).milliseconds(0).toDate();
                        planService.fromTime = $scope.fromTime;
                    }
                    planService.waypoints = angular.copy($scope.waypoints, []);
                    if($scope.waypoints.length == 2){
                        $scope.planTrip($http, validate);
                    }else{
                        $scope.planMultiLegTrip($http, validate);
                    }
                }
            }

            $scope.validateForm = function() {
                var valid = true;
                if ($scope.fromDate) {
                    $('#dateError').hide();
                }else{
                    $('#dateError').show();
                    valid = false;
                }

                if ($scope.fromTime) {
                    $('#timeError').hide();
                }else{
                    $('#timeError').show();
                    valid = false;
                }

                for(var i = 0; i < $scope.waypoints.length; i++){
                    var waypoint = $scope.waypoints[i];
                    var inputId;
                    var errorId;
                    var intermediateWaypoint = false;
                    if(i == 0){
                        inputId = '#fromInput';
                        errorId = '#fromError';
                    }else if(i == $scope.waypoints.length - 1){
                        inputId = '#toInput';
                        errorId = '#toError';
                    }else{
                        inputId = '#waypointInput-' + waypoint.id;
                        errorId = '#intermediateError-' + waypoint.id;
                        intermediateWaypoint = true;
                    }
                    if(waypoint.locationDetails){
                        $(inputId + ' input').removeClass('ng-invalid');
                        $(errorId).hide();
                        if(intermediateWaypoint){
                            if(waypoint.layoverTime && waypoint.layoverTime >=1 && waypoint.layoverTime <= 60){
                                $('#intermediateLayoverError-' + waypoint.id).hide();
                            }else{
                                $('#intermediateLayoverError-' + waypoint.id).show();
                                valid = false;
                            }
                        }
                    }else{
                        $(inputId + ' input').addClass('ng-invalid');
                        $(errorId).show();
                        valid = false;
                    }
                }

                if(moment().hours(0).minutes(0).seconds(0).milliseconds(0).diff($scope.fromDate, 'days') == 0
                    && moment().diff($scope.fromTime, 'minutes') > 0){
                    $('#timeError').show();
                    valid = false;
                }

                if($('.ng-invalid').length > 0)
                    valid = false;

                return valid;
            };

            $scope.resetForm = function(isEdit) {
                planService.getDefaults($http, $scope, isEdit);
                $scope.waypoints = [];

                planService.reset();
                if(placeMarkers.to){
                    placeMarkers.to.setMap(null);
                }
                if(placeMarkers.from){
                    placeMarkers.from.setMap(null);
                }
                angular.forEach(placeMarkers, function(marker, k){
                    marker.setMap(null);
                });
                $scope.mainMap.setCenter($scope.defaultPosition, 13);
                $scope.fromTimeType = 'asap';
                planService.fromTimeType = $scope.fromTimeType;
                $scope.fromDate = moment().seconds(0).milliseconds(0).toDate();
                planService.fromDate = $scope.fromDate;
                $scope.changeFromDate($scope.fromDate);
                $scope.fromTime = moment().seconds(0).milliseconds(0).toDate();
                planService.fromTime = $scope.fromTime;
                $('#toInputClear').removeClass('invalid-clear');
                $('#toInput input').removeClass('ng-invalid');
                $('#fromInputClear').removeClass('invalid-clear');
                $('#fromInput input').removeClass('ng-invalid');
                $('#fromError').hide();
                $('#toError').hide();
                $('#dateError').hide();
                $('#timeError').hide();
                $('#tp-date-simple').val($scope.fromDate);
                $('#tp-date-simple').trigger('change');

                $scope.collapseTripPlanningPreferences();
                $timeout(function () {
                    $('#fromInput input').focus();
                }, 500);
            }

            $scope.collapseTripPlanningPreferences = function() {
                $('#collapsePlanningPrefs').removeClass('in');
            }

            $scope.addWaypoint = function(index) {
                if ($scope.waypoints.length - 2 == $scope.maxWaypoints) {
                    bootbox.alert("The maximum number of waypoints have been added. Please remove an existing waypoint before adding another.");
                    return;
                }

                $scope.waypoints.splice(index, 0, {
                    id: Math.floor(new Date().valueOf() * Math.random()),
                    name: 'Waypoint ' + (index),
                    layoverTime: $scope.defaultLayoverTime,
                    locationDetails: null,
                    location: null,
                });

            }

            $scope.waypointNameFix = function(){
                var i;
                var max = $scope.waypoints.length-1;
                //waypoint name comes from the index of the item. use this after reversing waypoints or changing them
                //only run if more than 2 waypoints
                if( $scope.waypoints.length < 3 ){ return; }
                //skip the first and last elements, rename the rest
                for(i=1; i < max ; i+=1){
                    $scope.waypoints[i].name = 'Waypoint ' + i;
                }

            }

            $scope.addWaypointAtEnd = function() {
                $scope.addWaypoint($scope.waypoints.length - 1);
            }

            $scope.removeWaypoint = function(index) {

                if(index == 0){
                    placeMarkers[ 'from' ].setMap(null);
                }else if(index == $scope.waypoints.length -1){
                    placeMarkers[ 'to' ].setMap(null);
                }else{
                    if(placeMarkers[ $scope.waypoints[index].id ]){
                        placeMarkers[ $scope.waypoints[index].id ].setMap(null);
                        delete placeMarkers[ $scope.waypoints[index].id ];
                    }
                }
                $scope.waypoints.splice(index, 1);
            }

            // Drag-and-drop behavior of locations list.
            $scope.sortableOptions = {
                stop: function(e, ui) {
                    for(var i = 0; i < $scope.waypoints.length; i++){
                        var waypointId = $scope.waypoints[i].id;
                        var placeMarker;
                        if(i == 0){
                            placeMarker = placeMarkers.from;
                            if(placeMarkers[waypointId]){
                                placeMarkers[waypointId].setMap(null);
                                delete placeMarkers[waypointId];
                            }
                        }else if(i == $scope.waypoints.length - 1){
                            placeMarker = placeMarkers.to;
                            if(placeMarkers[waypointId]){
                                placeMarkers[waypointId].setMap(null);
                                delete placeMarkers[waypointId];
                            }
                        }else{
                            if(undefined === placeMarkers[waypointId]){
                                placeMarkers[waypointId] = new google.maps.Marker({
                                    label: {
                                        text: i.toString(),
                                        color: 'white',
                                        fontSize: '16px'
                                    },
                                    draggable: true,
                                    position: $scope.defaultPosition,
                                    icon: 'http://maps.google.com/mapfiles/ms/icons/purple.png'
                                });
                            }
                            placeMarker = placeMarkers[waypointId];
                        }
                        var locationDetails = $scope.waypoints[i].locationDetails;
                        if(locationDetails){
                            placeMarker.setMap($scope.mainMap);
                            placeMarker.setPosition(locationDetails.geometry.location);
                        }else{
                            placeMarker.setMap(null);
                        }
                    }
                }
            };

            $scope.startNewCall = function() {
                $scope.selectFirstTab();
                $scope.resultsTabbed = [];
                $scope.resetForm();
                $scope.mainMap.setCenter($scope.defaultPosition, 13);
            }

            $scope.editActiveTripItineraryTab = function() {
                var itineraryScope = this;
                $scope.resetForm(true);
                $scope.selectFirstTab();
                $scope.restoreTripPlanningPrefsFromItinerary(itineraryScope);
                for(var i = 0; i < $scope.waypoints.length; i++){
                    var waypointId = $scope.waypoints[i].id;
                    if(i == 0)
                        waypointId = 'from';
                    if(i == $scope.waypoints.length - 1)
                        waypointId = 'to';
                    setMarker($scope.waypoints[i].locationDetails.geometry.location, waypointId, true);
                }
                $timeout(function() {
                    google.maps.event.trigger($scope.mainMap, 'dragend');
                }, 200);
            }

            $scope.restoreTripPlanningPrefsFromItinerary = function(itineraryScope) {
                var itineraryPrefs = itineraryScope.tripPlanningPrefsObject;

                if(itineraryPrefs.fromTimeType == 'asap'){
                    itineraryPrefs.fromTime = moment().seconds(0).milliseconds(0).toDate();
                    itineraryPrefs.fromDate = moment().seconds(0).milliseconds(0).toDate();
                }

                $scope.from = itineraryPrefs.from;
                $scope.to = itineraryPrefs.to;
                $scope.fromTimeType = itineraryPrefs.fromTimeType;
                $scope.fromDate = itineraryPrefs.fromDate;
                $scope.fromTime = itineraryPrefs.fromTime;
                $scope.priority = itineraryPrefs.priority;
                $scope.includeRoutes = itineraryPrefs.includeRoutes;
                $scope.excludeRoutes = itineraryPrefs.excludeRoutes;
                $scope.transitOnlyMode = itineraryPrefs.transitOnlyMode;
                $scope.busOnlyMode = itineraryPrefs.busOnlyMode;
                $scope.railOnlyMode = itineraryPrefs.railOnlyMode;
                $scope.walkOnlyMode = itineraryPrefs.walkOnlyMode;
                $scope.bikeOnlyMode = itineraryPrefs.bikeOnlyMode;
                $scope.parkAndRideMode = itineraryPrefs.parkAndRideMode;
                $scope.bikeTransitMode = itineraryPrefs.bikeTransitMode;
                $scope.maxWalkTime = itineraryPrefs.maxWalkTime;
                $scope.maxWalkDistance = itineraryPrefs.maxWalkDistance;
                $scope.maxWalkPace = itineraryPrefs.maxWalkPace;
                $scope.maxBikeTime = itineraryPrefs.maxBikeTime;
                $scope.maxBikeDistance = itineraryPrefs.maxBikeDistance;
                $scope.maxBikePace = itineraryPrefs.maxBikePace;
                $scope.minTransferTime = itineraryPrefs.minTransferTime;
                $scope.maxTransferTime = itineraryPrefs.maxTransferTime;
                $scope.allowDeparturesTime = itineraryPrefs.allowDeparturesTime;
                $scope.tripShownRangeTime = itineraryPrefs.tripShownRangeTime;
                $scope.tripRangeTimeSlider = itineraryPrefs.tripRangeTimeSlider;
                $scope.waypoints = angular.copy(itineraryPrefs.waypoints, []);

                for(var i = 0; i < $scope.waypoints.length; i++){
                    var waypoint = $scope.waypoints[i];
                    if(i == 0){
                        setMarker(waypoint.locationDetails.geometry.location, 'from', false);
                    }else if(i == $scope.waypoints.length - 1){
                        setMarker(waypoint.locationDetails.geometry.location, 'to', false);
                    }else{
                        setMarker(waypoint.locationDetails.geometry.location, waypoint.id, false);
                    }
                }

                $scope.changeFromDate($scope.fromDate);
                $('#tp-date-simple').val($scope.fromDate);
            }

            $scope.updateActiveTripItineraryTab = function() {
                var itineraryScope = this;
                $scope.resetForm();
                $scope.restoreTripPlanningPrefsFromItinerary(itineraryScope);
                $scope.submitForm(false);
            }

            $scope.reverseActiveTripItineraryTab = function() {

                var itineraryScope = this;
                $scope.resetForm(true);
                $scope.selectFirstTab();
                $scope.restoreTripPlanningPrefsFromItinerary(itineraryScope);

                // Reverse origin and destination from itinerary.
                $scope.waypoints = angular.copy(itineraryScope.tripPlanningPrefsObject.waypoints, []);
                $scope.waypoints.reverse();
                $scope.waypointNameFix();

                for(var i = 0; i < $scope.waypoints.length; i++){
                    var waypointId = $scope.waypoints[i].id;
                    if(i == 0)
                        waypointId = 'from';
                    if(i == $scope.waypoints.length - 1)
                        waypointId = 'to';
                    setMarker($scope.waypoints[i].locationDetails.geometry.location, waypointId, true);
                }
                $timeout(function() {
                    google.maps.event.trigger($scope.mainMap, 'dragend');
                }, 200);
            }

            $scope.openCalendar = function($event) {
                $event.preventDefault();
                $event.stopPropagation();
                $scope.opened = true;
            };

            $scope.showError = function (error) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        $scope.error = "User denied the request for Geolocation."
                        break;
                    case error.POSITION_UNAVAILABLE:
                        $scope.error = "Location information is unavailable."
                        break;
                    case error.TIMEOUT:
                        $scope.error = "The request to get user location timed out."
                        break;
                    case error.UNKNOWN_ERROR:
                        $scope.error = "An unknown error occurred."
                        break;
                }
                $scope.$apply();
            }

            function extendAddressDetails(address){
                if(typeof address.geometry.location.lat == 'string'){
                    address.geometry.location.lat = parseFloat(address.geometry.location.lat);
                    address.geometry.location.lng = parseFloat(address.geometry.location.lng);
                }
                //add properties for each address component ex: address.route, address.street_number
                angular.forEach(address.address_components, function(v1, k){
                    angular.forEach(v1.types, function(v2, k2){
                        address[v2] = v1.long_name;
                    });
                });
                return address;
            }

            $scope.handleBoundary = function(){

                if(planService.polygon){
                    return;
                }

                $http.get('/api/v1/places/boundary').
                success(function(data) {

                    planService.polygon = data;

                    $scope.addBoundaryToMap(data);
                });

                mapLayerService.addAllLayersToMap($scope.mainMap, $scope.mapLayersById);
                $scope.addMapLayerToggleToMap($scope.mainMap);
            }

            $scope.addBoundaryToMap = function(data) {
                var map = $scope.mainMap;
                var featureCollection = planService.createFeatureCollection(data);
                map.data.setStyle(function (feature) {
                    return {
                        fillOpacity: "0.2",
                        strokeWeight: "1"
                    };
                });
                map.data.addGeoJson(featureCollection);
            }

            $scope.addMapLayerToggleToMap = function(map) {
                var controlDiv = document.createElement('div');
                var controlUI = document.getElementById("mapLayerCheckboxes");
                controlDiv.appendChild(controlUI);

                controlDiv.index = 1;
                map.controls[google.maps.ControlPosition.TOP_CENTER].push(controlDiv);
            }

            $scope.toggleMapLayer = function(event) {
                mapLayerService.toggleMapLayer($scope.mainMap, $scope.mapLayersById, event.target.id, event.target.checked);
            }

            $scope.checkServiceArea = function(result, place, waypointId, showConfirmation){
                place = place || $scope.place;
                waypointId = waypointId || $scope.waypointId;
                var serviceAreaPromise = planService.checkServiceArea($http, result);
                serviceAreaPromise.
                success(function(serviceAreaResult) {

                    if(serviceAreaResult.result == true){

                        var location = result.geometry.location;
                        if($scope.poi){
                            var poilocation = $scope.poi.geometry.location;
                            location = new google.maps.LatLng(Number(poilocation.lat), Number(poilocation.lng));
                        }

                        if(typeof location.lat == "number" ||
                            !isNaN(location.lat)){
                            location = new google.maps.LatLng(Number(location.lat), Number(location.lng));
                        }

                        var selectedLocationDetails = extendAddressDetails(result);
                        var selectedLocation;

                        if(waypointId == 'from'){
                            selectedLocation = $scope.waypoints[0];
                        }else if(waypointId == 'to'){
                            selectedLocation = $scope.waypoints[$scope.waypoints.length - 1];
                        }else{
                            for(var i = 0; i < $scope.waypoints.length; i++){
                                if($scope.waypoints[i].id == waypointId){
                                    selectedLocation = $scope.waypoints[i];
                                    break;
                                }
                            }
                        }
                        if(showConfirmation){
                            bootbox.confirm({
                                message: 'Select location ' + place + '?',
                                buttons: {
                                    'cancel': {
                                        label: 'No'
                                    },
                                    'confirm': {
                                        label: 'Yes'
                                    }
                                },
                                callback: function(result) {
                                    if(result){
                                        setMarker(location, waypointId);
                                        $scope.pauseAutocomplete = true;
                                        selectedLocation.location = place;
                                        selectedLocation.locationDetails = selectedLocationDetails;
                                    }else{
                                        placeMarkers[$scope.getWaypointId(waypointId)].setMap(null);
                                    }
                                }
                            });
                        }else{
                            setMarker(location, waypointId);
                            selectedLocation.location = place;
                            selectedLocation.locationDetails = selectedLocationDetails;
                        }
                    }else{
                        $scope.showMap = false;
                        $scope.showNext = false;
                        bootbox.alert("The location you selected is outside the service area.");
                    }
                    usSpinnerService.stop('spinner-1');
                    $scope.submitDisabled = false;
                }).
                error(function(serviceAreaResult) {
                    bootbox.alert("An error occured on the server, please retry your search or try again later.");
                });

            }

            $scope.selectResult = function(place, waypointId){
                $scope.waypointId = $scope.getWaypointId(waypointId);
                $scope.selectPlace(place);
            }

            $scope.getWaypointId = function(waypointId){
                for(var i = 0; i < $scope.waypoints.length; i++){
                    if($scope.waypoints[i].id == waypointId){
                        if(i == 0){
                            waypointId = 'from';
                        }else if (i == $scope.waypoints.length - 1){
                            waypointId = 'to';
                        }
                        break;
                    }
                }
                return waypointId;
            }

            $scope.selectPlace = function(place){
                $scope.submitDisabled = true;
                $scope.place = place;
                $scope.poi = null;
                var placeIdPromise = $q.defer();
                var selectedIndex = $scope.placeLabels.indexOf(place);
                var placeId = $scope.placeIds[selectedIndex];
                var poiPlace = findPlaceInLocationPoiData(place)
                if(placeId) {
                    placeIdPromise.resolve(placeId);
                }else if( poiPlace ){
                    var result = {};
                    result.name = place;
                    result.geometry = {};
                    result.geometry.location = poiPlace.geometry.location;
                    $scope.checkServiceArea(result);
                }else{
                    var labelIndex = $scope.placeLabels.indexOf(place);
                    var address = $scope.placeLabels[labelIndex];
                    var autocompleteService = new google.maps.places.AutocompleteService();
                    autocompleteService.getPlacePredictions(
                        {
                            input: address,
                            offset: 0,
                            componentRestrictions: {country: 'us'}
                        }, function(list, status) {
                            if(status == "ZERO_RESULTS" || list == null){
                                bootbox.alert("We were unable to geocode the address you selected: " + address);
                            }else{
                                var placeId = list[0].place_id;
                                placeIdPromise.resolve(placeId);
                            }
                        });
                }

                placeIdPromise.promise.then(function(placeId) {
                    var placeData = undefined;
                    if(LocationSearch.poiData){
                        for(var i = 0; i < LocationSearch.poiData.length; i++){
                            if(LocationSearch.poiData[i].place_id == placeId)
                                placeData = LocationSearch.poiData[i];
                        }
                    }
                    if(placeData){
                        $scope.checkServiceArea(placeData);
                    }else{
                        var placesService = new google.maps.places.PlacesService(document.getElementById('hiddenmap'));
                        placesService.getDetails( { 'placeId': placeId}, function(result, status) {
                            if (status == google.maps.GeocoderStatus.OK) {

                                result.place_predictions_id = placeId;

                                //verify the location has a street address
                                var datatypes = [];
                                var route;
                                angular.forEach(result.address_components, function(component, index) {
                                    angular.forEach(component.types, function(type, index) {
                                        datatypes.push(type);
                                        if(type == 'route'){
                                            route = component.long_name;
                                        }
                                    });
                                });

                                var typeIsIntersection = (result.types.length > 0 && (result.types[0].indexOf('intersection') > -1));
                                if(!typeIsIntersection) {
                                    // An intersection will have a route without street number. So perform check only if place is not intersection.
                                    if(datatypes.indexOf('street_number') < 0 || datatypes.indexOf('route') < 0){
                                        if(datatypes.indexOf('street_number') < 0){
                                            var streetNameIndex = $scope.place.indexOf(route);
                                            if(streetNameIndex > -1){
                                                var prefix = $scope.place.substr(0, streetNameIndex);
                                                prefix = prefix.trim();
                                                var streetComponent = {};
                                                streetComponent.short_name = prefix;
                                                streetComponent.long_name = prefix;
                                                streetComponent.types = [];
                                                streetComponent.types.push('street_number');
                                                result.address_components.push(streetComponent);
                                            }
                                        }
                                    }
                                }

                                $scope.checkServiceArea(result);

                            } else {
                                bootbox.alert('Geocode was not successful for the following reason: ' + status);
                            }
                        });
                    }
                })
            }

            function findPlaceInLocationPoiData(place)
            {
                var poiData = LocationSearch.poiData;
                var data = null;

                angular.forEach(poiData, function(poi){
                    if(place.includes("Stop #") && place.includes("-"))
                    {
                        var indexOfDash = place.indexOf('-');
                        var placeStr = place.substring(indexOfDash + 2);
                        if (placeStr === (poi.name) )
                        {
                            data = poi;
                        }
                    }else{
                        if (place === (poi.name+' '+poi.formatted_address) )
                        {
                            data = poi;
                        }
                    }
                });

                return data;
            }

            $scope.getLocations = function(typed){
                if(typed){
                    var config = planService.getHeaders();
                    $scope.suggestions = LocationSearch.getLocations(typed, config, $scope.blacklist);
                    $scope.suggestions.then(function(data){

                        var sortFunc = function(obj1, obj2) {
                            if(!obj1.match || !obj2.match)
                                return 0;
                            var A = obj1.match.length;
                            var B = obj2.match.length;
                            if (A > B){
                                return -1;
                            }else if (A < B){
                                return  1;
                            }else{
                                return 0;
                            }
                        };

                        var googlePlaces = data[0];
                        var googleInteresections = data[1];
                        var oneClickLocations = data[2];
                        var recentSearches = data[3];

                        var searchResults = [];
                        $scope.placeLabels = [];
                        $scope.placeIds = [];
                        $scope.poiData = {};

                        //google intersections
                        incrementalSearchResults = [];
                        if(googleInteresections.googleplaces.length > 0){
                            for(var i = 0; i < googleInteresections.googleplaces.length; i++){
                                if($scope.placeIds.indexOf(googleInteresections.placeIds[i]) == -1){
                                    incrementalSearchResults.push({label:googleInteresections.googleplaces[i], option: true, placeId: googleInteresections.placeIds[i]});
                                    $scope.placeLabels.push(googleInteresections.googleplaces[i]);
                                    $scope.placeIds.push(googleInteresections.placeIds[i]);
                                }
                            }
                            $scope.setMatchingString(typed, incrementalSearchResults);
                            incrementalSearchResults.sort(sortFunc);
                            if(incrementalSearchResults.length > 5)
                                incrementalSearchResults.length = 5;
                            if(incrementalSearchResults.length > 0){
                                searchResults.push({label:'Intersections', option: false, deleteall: false, items: incrementalSearchResults});
                            }

                        }

                        //rtd custom locations (only stops)
                        incrementalSearchResults = [];
                        if(oneClickLocations.savedplaces.length > 0){
                            for(var i = 0; i < oneClickLocations.savedplaces.length; i++){
                                if($scope.placeIds.indexOf(oneClickLocations.placeIds[i]) == -1){
                                    var poiData = oneClickLocations.poiData[i];
                                    if(poiData && poiData.stop_code){
                                        incrementalSearchResults.push({label:oneClickLocations.savedplaces[i], option: true, placeId: oneClickLocations.placeIds[i]});
                                        $scope.placeLabels.push(oneClickLocations.savedplaces[i]);
                                        $scope.placeIds.push(poiData.place_id);
                                        $scope.poiData[oneClickLocations.savedplaces[i]] = poiData;
                                    }

                                }

                            }
                            $scope.setMatchingString(typed, incrementalSearchResults);
                            incrementalSearchResults.sort(sortFunc);
                            if(incrementalSearchResults.length > 5)
                                incrementalSearchResults.length = 5;
                            if(incrementalSearchResults.length > 0){
                                searchResults.push({label:'RTD stops', option: false, deleteall: false, items: incrementalSearchResults});
                            }
                        }

                        //rtd stations
                        incrementalSearchResults = [];
                        if(oneClickLocations.savedplaces.length > 0){
                            for(var i = 0; i < oneClickLocations.savedplaces.length; i++){
                                if($scope.placeIds.indexOf(oneClickLocations.placeIds[i]) == -1){
                                    var poiData = oneClickLocations.poiData[i];
                                    if(poiData && poiData.types && poiData.types.indexOf('station') > -1){
                                        incrementalSearchResults.push({label:oneClickLocations.savedplaces[i], option: true, placeId: oneClickLocations.placeIds[i]});
                                        $scope.placeLabels.push(oneClickLocations.savedplaces[i]);
                                        $scope.placeIds.push(poiData.place_id);
                                        $scope.poiData[oneClickLocations.savedplaces[i]] = poiData;
                                    }

                                }

                            }
                            $scope.setMatchingString(typed, incrementalSearchResults);
                            incrementalSearchResults.sort(sortFunc);
                            if(incrementalSearchResults.length > 5)
                                incrementalSearchResults.length = 5;
                            if(incrementalSearchResults.length > 0){
                                searchResults.push({label:'RTD stations', option: false, deleteall: false, items: incrementalSearchResults});
                            }
                        }

                        //rtd custom locations (except stops)
                        incrementalSearchResults = [];
                        if(oneClickLocations.savedplaces.length > 0){
                            for(var i = 0; i < oneClickLocations.savedplaces.length; i++){
                                if( ($scope.placeIds.indexOf(oneClickLocations.placeIds[i]) == -1) ||
                                    ($scope.placeIds.indexOf(oneClickLocations.placeIds[i]) == 0 && oneClickLocations.placeIds[i] === null) )
                                {
                                    var poiData = oneClickLocations.poiData[i];
                                    if(!poiData || !poiData.stop_code){
                                        incrementalSearchResults.push({label:oneClickLocations.savedplaces[i], option: true, placeId: oneClickLocations.placeIds[i]});
                                        $scope.placeLabels.push(oneClickLocations.savedplaces[i]);
                                        $scope.placeIds.push(oneClickLocations.placeIds[i]);
                                    }
                                }
                            }
                            $scope.setMatchingString(typed, incrementalSearchResults);
                            incrementalSearchResults.sort(sortFunc);
                            if(incrementalSearchResults.length > 5)
                                incrementalSearchResults.length = 5;
                            if(incrementalSearchResults.length > 0){
                                searchResults.push({label:'RTD custom places', option: false, deleteall: false, items: incrementalSearchResults});
                            }
                        }

                        //google places
                        var incrementalSearchResults = [];
                        if(googlePlaces.googleplaces.length > 0){
                            for(var i = 0; i < googlePlaces.googleplaces.length; i++){
                                if($scope.placeIds.indexOf(googlePlaces.placeIds[i]) == -1){
                                    incrementalSearchResults.push({label:googlePlaces.googleplaces[i], option: true, placeId: googlePlaces.placeIds[i]});
                                    $scope.placeLabels.push(googlePlaces.googleplaces[i]);
                                    $scope.placeIds.push(googlePlaces.placeIds[i]);
                                }
                            }
                            $scope.setMatchingString(typed, incrementalSearchResults);
                            incrementalSearchResults.sort(sortFunc);
                            if(incrementalSearchResults.length > 5)
                                incrementalSearchResults.length = 5;
                            if(incrementalSearchResults.length > 0){
                                searchResults.push({label:'Google places', option: false, deleteall: false, items: incrementalSearchResults});
                            }

                        }

                        //now flatten the list for the autocomplete widget
                        var options = [];
                        for(var i = 0; i < searchResults.length; i++){
                            var optionGroup = searchResults[i];
                            options.push(optionGroup);
                            for(var j = 0; j < optionGroup.items.length; j++){
                                var option = optionGroup.items[j];
                                options.push(option);
                            }
                        }

                        $scope.locations = options;
                    });
                }
            }

            $scope.setMatchingString = function(typed, searchResults){
                for(var i = 0; i < searchResults.length; i++){
                    var label = searchResults[i].label.toLowerCase();
                    var searchTerm = typed.toLowerCase();
                    var match = "";
                    for(var j = searchTerm.length; j > 0; j--){
                        var subString = searchTerm.substr(0, j);
                        if(label.indexOf(subString) > -1){
                            match = subString;
                            break;
                        }
                    }
                    searchResults[i].match = match;
                }
            }

            $scope.handlePausedAutocomplete = function(model, search){
                $scope.pauseAutocomplete = false;
            }

            $scope.handleLocationEdit = function(newVal, oldVal, id) {
                var location;
                for(var i = 0; i < $scope.waypoints.length; i++){
                    if($scope.waypoints[i].id == id){
                        location = $scope.waypoints[i];
                    }
                }

                if(location){
                    var index = $scope.waypoints.indexOf(location);
                    var inputId;
                    var errorId;
                    if(index == 0){
                        inputId = '#fromInput';
                        errorId = '#fromError';
                    }else if(index == $scope.waypoints.length - 1){
                        inputId = '#toInput';
                        errorId = '#toError';
                    }else{
                        inputId = '#waypointInput-' + id;
                        errorId = '#intermediateError-' + id;
                    }

                    $(inputId + ' input').removeClass('ng-invalid');
                    $(errorId).hide();
                    location.locationDetails = null;

                    var markerId = location.id;
                    if(index == 0){
                        markerId = 'from';
                    }else if(index == $scope.waypoints.length -1){
                        markerId = 'to';
                    }
                    if( placeMarkers[ markerId ] ){
                        placeMarkers[ markerId ].setMap(null);
                        if(index > 0 && index < $scope.waypoints.length -1)
                            delete placeMarkers[ markerId ];
                    }
                }
            }

            $scope.updateClock = function() {
                $timeout(function () {
                    if(!$scope.fromTime || $scope.fromTimeType == 'asap'){
                        $scope.fromTime = moment().seconds(0).milliseconds(0).toDate();
                    }
                    setTimeout($scope.updateClock, 1000);
                });

            }

            $scope.updateClock();
        }
    ]);