'use strict';

angular.module('applyMyRideApp')
  .controller('ItineraryController', ['$scope','$routeParams', '$timeout', '$location', 'flash', 'mapLayerService', 'planService', '$http', '$filter', '$modal', 'usSpinnerService',
    function ($scope, $routeParams, $timeout, $location, flash, mapLayerService, planService, $http, $filter, $modal, usSpinnerService) {

      $scope.mapOptions = {
        zoom: 12,
        mapTypeControl: true,
        panControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
      $scope.mapLayersById = {};

      $scope.loadedBoundary = false;
      $scope.mapElements = [];
      $scope.wizardMapElements = [];
      $scope.tripPlanningPrefsObject = angular.copy(planService.tripPlanningPrefsObject, {}); //planService.tripPlanningPrefsObject;
      $scope.searchResults = planService.searchResults;
      $scope.fromTimeType = planService.fromTimeType
      $scope.fromDate = $scope.tripPlanningPrefsObject.fromDate;
      $scope.fromTime = $scope.tripPlanningPrefsObject.fromTime;
      $scope.from = planService.from;
      $scope.to = planService.to;
      $scope.fromShort = "fromShort";//planService.fromDetails.address_components[2].short_name;
      $scope.toShort = "toShort";//planService.toDetails.address_components[2].short_name;
      $scope.routesSortBy = 'duration';
      $scope.routesSortBy = 'end_time'; //default is "Arrive By" now, used to be "Travel Time" = 'duration';
      $scope.viewport;
      $scope.fromDetails = $scope.tripPlanningPrefsObject.waypoints[0].locationDetails;
      $scope.toDetails = $scope.tripPlanningPrefsObject.waypoints[$scope.tripPlanningPrefsObject.waypoints.length - 1].locationDetails;

      $scope.$watch('routeMap', function(n, k) {
        if(n != null && planService.searchResults){
          $scope.prepareView();
          if(!$scope.isMultiLeg && planService.searchResults.itineraries.length > 0){
            $scope.selectItinerary(0);
          }
        }
      });

      angular.forEach($scope.tripPlanningPrefsObject.waypoints, function(waypoint, index) {
        if(waypoint.locationDetails.stop_code){
          waypoint.locationDetails.formatted_address = waypoint.location;
        }
      });

      $scope.fromDescription = $scope.fromDetails.formatted_address;
      $scope.toDescription = $scope.toDetails.formatted_address;

      $scope.wizard = function() {
        usSpinnerService.spin('spinner-1');
        $scope.isWizard = true;
        $scope.wizardResults = [];  //holds the results history
        $scope.wizardSelectedItineraryIds = [];  //holds the selected itinerary history

        //repeat the search for the first leg
        var reverseOrder = 'arrive' == $scope.fromTimeType;
        if($scope.fromTimeType == 'asap')
          $scope.tripPlanningPrefsObject.fromTime = moment().seconds(0).milliseconds(0).toDate();
        $scope.fromDate = $scope.tripPlanningPrefsObject.fromDate;
        $scope.fromTime = $scope.tripPlanningPrefsObject.fromTime;
        planService.fromDate = $scope.fromDate;
        planService.fromTime = $scope.fromTime;
        var legIndex;
        if(reverseOrder){
          legIndex = $scope.tripPlanningPrefsObject.waypoints.length - 1;
        }else{
          legIndex = 0;
        }

        planService.prepareItineraryRequestObject($scope, legIndex, reverseOrder);

        var promise = planService.postItineraryRequest($http);
        promise.success(function(result) {
          usSpinnerService.stop('spinner-1');
          if(result.itineraries.length < 1){
            bootbox.alert("No trips found for your search.");
            usSpinnerService.stop('spinner-wizard');
            return;
          }
          angular.forEach(result.itineraries, function(itinerary, index) {
            itinerary.origin_in_callnride = result.origin_in_callnride;
            itinerary.destination_in_callnride = result.destination_in_callnride;
            itinerary.origin_callnride = result.origin_callnride;
            itinerary.destination_callnride = result.destination_callnride;
            itinerary.hasNext = true;
            planService.setItineraryDescriptions(itinerary, result);
            if(itinerary.json_legs){
              angular.forEach(itinerary.json_legs, function(leg, index) {
                planService.setRealTimeData(leg);
                planService.setItineraryLegDescriptions(leg);
                angular.forEach(leg.steps, function(step, index) {
                  planService.setWalkingDescriptions(step);
                });
                if(leg.hasNext == false)
                    itinerary.hasNext = false;
              });
            }
          });
          $scope.modalSearchResults = result;;
          $scope.wizardResults.push($scope.modalSearchResults);

          $scope.modalInstance = $modal.open({
            windowClass: 'wizard-modal',
            templateUrl: 'views/wizard.html',
            scope:$scope,
            controller: [
              '$scope', '$modalInstance', function($scope, $modalInstance){
                $scope.closeModal = function () {
                  $modalInstance.close();
                };
                $scope.back = function () {
                  $scope.editWizardSegment()
                };
                $scope.selectAndContinue = function () {
                  $scope.$parent.$modalInstance = $modalInstance;
                  $scope.selectWizardSegment();
                };
              }
            ]
          }).result.catch(function(){
            $scope.isWizard = false;
          });

          function initialize() {
            var myOptions = {
              zoom: 13,
              center: new google.maps.LatLng(39.7392, -104.9903),
              mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            $scope.wizardRouteMap = new google.maps.Map(document.getElementById("wizardMap"),
                myOptions);
            if($scope.tripPlanningPrefsObject.fromTimeType === 'arrive'){
              $scope.wizardSegmentIndex = $scope.tripPlanningPrefsObject.waypoints.length - 1;
            }else{
              $scope.wizardSegmentIndex = 0;
            }
            $scope.prepareView();
            $scope.filterItineraries(null, null, true);
            $scope.selectItinerary(0);
          }
          $timeout(function() {
            initialize()
          }, 100);
        });
      }

      $scope.selectWizardSegment = function(){
        $scope.wizardSelectedItineraryIds.push($scope.wizardSelectedItineraryIndex);
        usSpinnerService.spin('spinner-wizard');
        var reverseOrder;
        var fromDateTime;
        if($scope.tripPlanningPrefsObject.fromTimeType === 'arrive'){
          reverseOrder = true;
          var startTime = $scope.wizardSelectedItinerary.start_time;
          var layoverTime = $scope.tripPlanningPrefsObject.waypoints[$scope.wizardSegmentIndex].layoverTime;
          fromDateTime = moment(startTime).subtract(layoverTime, 'minutes').toDate();
          $scope.wizardSegmentIndex--;
        }else{
          reverseOrder = false;
          var endTime = $scope.wizardSelectedItinerary.end_time;
          var layoverTime = $scope.tripPlanningPrefsObject.waypoints[$scope.wizardSegmentIndex + 1].layoverTime;
          fromDateTime = moment(endTime).add(layoverTime, 'minutes').toDate();
          $scope.wizardSegmentIndex++;
        }

        if($scope.wizardSelectedItineraryIds.length == $scope.tripPlanningPrefsObject.waypoints.length - 1){
          var searchResults = [];
          angular.forEach($scope.wizardResults, function (result, index) {
            var itineraries = [];
            itineraries.push(result.itineraries[$scope.wizardSelectedItineraryIds[index]]);
            result.itineraries = itineraries;
            searchResults.push(result);
          });

          if(reverseOrder){
            searchResults = searchResults.slice().reverse();
          }

          $scope.selectedItineraryIndex = -1;
          var itinerarySummary = $scope.prepareItinerarySummary(searchResults);
          $scope.itinerarySummary = itinerarySummary;
          $scope.selectedItinerary = $scope.itinerarySummary;
          $scope.searchResults = searchResults;
          $scope.isWizard = false;
          $scope.selectItinerarySummary();
          $scope.$modalInstance.close();
          return;
        }
        $scope.wizardSelectedItineraryIndex = 0;
        planService.fromDate = fromDateTime;
        planService.fromTime = fromDateTime;
        planService.prepareItineraryRequestObject($scope, $scope.wizardSegmentIndex, reverseOrder);

        var promise = planService.postItineraryRequest($http);
        promise.success(function(result) {
          $scope.wizardResults.push(result);
          usSpinnerService.stop('spinner-wizard');
          if (result.itineraries.length < 1) {
            bootbox.alert("No trips found for your search.");
            usSpinnerService.stop('spinner-1');
            return;
          }
          angular.forEach(result.itineraries, function (itinerary, index) {
            itinerary.origin_in_callnride = result.origin_in_callnride;
            itinerary.destination_in_callnride = result.destination_in_callnride;
            itinerary.origin_callnride = result.origin_callnride;
            itinerary.destination_callnride = result.destination_callnride;
            planService.setItineraryDescriptions(itinerary, result);
            if (itinerary.json_legs) {
              angular.forEach(itinerary.json_legs, function (leg, index) {
                planService.setRealTimeData(leg);
                planService.setItineraryLegDescriptions(leg);
                angular.forEach(leg.steps, function (step, index) {
                  planService.setWalkingDescriptions(step);
                });
              });
            }
          });
          $scope.modalSearchResults = result;
          $scope.prepareView();
          $scope.filterItineraries(null, null, true);
          $scope.selectItinerary(0);
        });
      }

      $scope.disableWizardBack = function(){
        if($scope.tripPlanningPrefsObject.fromTimeType === 'arrive'){
          return $scope.wizardSegmentIndex >= $scope.tripPlanningPrefsObject.waypoints.length - 1;
        }else{
          return $scope.wizardSegmentIndex == 0;
        }
      }

      $scope.editWizardSegment = function(){
        if($scope.tripPlanningPrefsObject.fromTimeType === 'arrive'){
          $scope.wizardSegmentIndex++;
        }else{
          $scope.wizardSegmentIndex--;
        }
        $scope.wizardResults.pop();
        $scope.wizardSelectedItineraryIds.pop();
        $scope.modalSearchResults = $scope.wizardResults.slice(-1)[0]
        $scope.prepareView();
        $scope.filterItineraries(null, null, true);
        $scope.selectItinerary(0);
      }

      $scope.closeModal = function(){
        $scope.modalInstance.close();
      }

      function extendAddressDetails(address){
        //add properties for each address component ex: address.route, address.street_number
        angular.forEach(address.address_components, function(v1, k){
          angular.forEach(v1.types, function(v2, k2){
            address[v2] = v1.long_name;
          });
        });
        return address;
      }

      $scope.prepareView = function() {

        if($scope.isMultiLeg && !$scope.isWizard){
          $scope.selectedItineraryIndex = -1;
          $scope.itinerarySummary = $scope.prepareItinerarySummary();
          $scope.selectItinerarySummary();
        }else{
          //setup the sliders with max values based on results max
          $scope.transferSlider = {max:0, value:0};
          $scope.walkSlider = {max:0, value:0};
          $scope.bikeSlider = {max:0, value:0};

          var itineraries;
          if($scope.isWizard){
            itineraries = $scope.modalSearchResults.itineraries;
          }else{
            itineraries = $scope.searchResults.itineraries
          }
          itineraries.forEach(function(val, key){
            var i, haveBus=false;
            $scope.transferSlider.max = Math.ceil(Math.max( val.wait_time, $scope.transferSlider.max));
            $scope.walkSlider.max = Math.ceil(Math.max( val.walk_distance, $scope.walkSlider.max));
            var totalBikeDistanceInMeters = 0;
            val.json_legs.forEach(function(leg, key){
              if(leg.mode == 'BICYCLE'){
                totalBikeDistanceInMeters += leg.distance;
              }
            })
            if(totalBikeDistanceInMeters > $scope.bikeSlider.max)
              $scope.bikeSlider.max = totalBikeDistanceInMeters;
            itineraries[key].end_location = extendAddressDetails(itineraries[key].end_location);
            itineraries[key].start_location = extendAddressDetails(itineraries[key].start_location);
            //if the name has an address in it, name_address is just copy of address
            itineraries[key].end_location.name_address = (null !== (itineraries[key].end_location.name||'').match(/, Colorado [0-9]{5}/))
                ? itineraries[key].end_location.name
                : itineraries[key].end_location.name
            + ' '
            + itineraries[key].end_location.street_address
            + ', '
            + itineraries[key].end_location.locality
            + ',  Colorado';

            itineraries[key].start_location.name_address = (null !== (itineraries[key].start_location.name||'').match(/, Colorado [0-9]{5}/))
                ? itineraries[key].start_location.name
                : itineraries[key].start_location.name
            + ' '
            + itineraries[key].start_location.street_address
            + ', '
            + itineraries[key].start_location.locality
            + ',  Colorado';
            //get the first bus departure for each itinerary, make a viewport that holds all itineraries
            for(i = 0; i < val.json_legs.length; i+=1){
              $scope.viewport = getLegBox(val.json_legs[i], $scope.viewport);
            }
            planService.setBusRailDepartures(val);

            $scope.$watch('routesSortBy', $scope.filterItineraries);
            $scope.$watch('routesToShow', $scope.filterItineraries);
            $scope.$watch('transferSlider.value', $scope.filterItineraries);
            $scope.$watch('walkSlider.value', $scope.filterItineraries);
            $scope.$watch('bikeSlider.value', $scope.filterItineraries);
          });

          //pad the max (or it's hard to select the 'all' values)
          if($scope.transferSlider.max > 0)
            $scope.transferSlider.max += 60;
          if($scope.walkSlider.max > 0)
            $scope.walkSlider.max += 528;
          //if($scope.bikeSlider.max > 0)
          //$scope.bikeSlider.max += 528;
          //select the highest value
          $scope.transferSlider.value = $scope.transferSlider.max;
          $scope.walkSlider.value = $scope.walkSlider.max;
          $scope.bikeSlider.value = $scope.bikeSlider.max;
        }
      }



      $scope.prepareItinerarySummary = function(searchResults) {
        if(!searchResults)
          searchResults = $scope.searchResults;
        var itinerarySummary = angular.copy(searchResults[0].itineraries[0], {});
        itinerarySummary.end_location = angular.copy(searchResults[searchResults.length - 1].itineraries[0].end_location, {});
        itinerarySummary.duration = 0;
        itinerarySummary.wait_time = 0;
        itinerarySummary.walk_distance = 0;
        itinerarySummary.walk_time = 0;
        itinerarySummary.transfers = 0;
        itinerarySummary.total_distance = 0;
        itinerarySummary.origin_in_callnride = searchResults[0].origin_in_callnride;
        itinerarySummary.destination_in_callnride = searchResults[searchResults.length - 1].destination_in_callnride;
        itinerarySummary.origin_callnride = searchResults[0].origin_callnride;
        itinerarySummary.destination_callnride = searchResults[searchResults.length - 1].destination_callnride;

        var haveBus=false;
        itinerarySummary.bike_time = 0;
        itinerarySummary.bike_distance = 0;
        searchResults.forEach(function(result, key){
          var itinerary = result.itineraries[0];
          itinerary.origin_in_callnride = result.origin_in_callnride;
          itinerary.destination_in_callnride = result.destination_in_callnride;
          itinerary.origin_callnride = result.origin_callnride;
          itinerary.destination_callnride = result.destination_callnride;
          if(itinerary.lastRun)
              itinerarySummary.lastRun = itinerary.lastRun;
          itinerary.bike_time = 0;
          itinerary.bike_distance = 0;
          itinerarySummary.wait_time += itinerary.wait_time;
          itinerarySummary.walk_distance += itinerary.walk_distance;
          itinerarySummary.total_distance += itinerary.total_distance;
          itinerarySummary.transfers += itinerary.transfers;
          itinerarySummary.end_time = itinerary.end_time;
          if(itinerary.json_legs){
            for(var i = 0; i < itinerary.json_legs.length; i++){
              $scope.viewport = getLegBox(itinerary.json_legs[i], null);

              if(!haveBus && 'BUS' === itinerary.json_legs[i].mode){
                haveBus = true;
                var leg = itinerary.json_legs[i];
                if(leg.realTime){
                  var scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                  itinerarySummary.bus_depart = scheduledStartTime;
                  itinerarySummary.real_bus_depart = leg.startTime;
                }else{
                  itinerarySummary.bus_depart = leg.startTime;
                }
              }else if(!haveBus && ('TRAM' === itinerary.json_legs[i].mode || 'RAIL' === itinerary.json_legs[i].mode)){
                haveBus = true;
                var leg = itinerary.json_legs[i];
                if(leg.realTime){
                  var scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                  itinerary.rail_depart = scheduledStartTime;
                  itinerarySummary.real_rail_depart = leg.startTime;
                }else{
                  itinerarySummary.rail_depart = leg.startTime;
                }
              }else if(!haveBus && 'BICYCLE' === itinerary.json_legs[i].mode ){
                itinerary.bike_time += itinerary.json_legs[i].duration;
                itinerary.bike_distance += itinerary.json_legs[i].distance;
              }
            }
          }
          itinerarySummary.bike_time += itinerary.bike_time;
          itinerarySummary.bike_distance += itinerary.bike_distance;
        });

        itinerarySummary.firstSegment = true;
        itinerarySummary.lastSegment = true;
        itinerarySummary.duration = (moment(itinerarySummary.end_time).diff(itinerarySummary.start_time)) / 1000;

        searchResults.forEach(function(searchResult, index){
          if(index > 0){
            var waitLeg = {mode: 'WAIT', layoverTime: $scope.waypoints[index].layoverTime, end_location: $scope.waypoints[index].locationDetails};
            if(index < $scope.waypoints.length - 1)
                waitLeg.waypointIndex = index;
            waitLeg.origin_in_callnride = searchResult.origin_in_callnride;
            waitLeg.destination_in_callnride = searchResult.destination_in_callnride;
            waitLeg.origin_callnride = searchResult.origin_callnride;
            waitLeg.destination_callnride = searchResult.destination_callnride;
            itinerarySummary.json_legs.push(waitLeg);
            itinerarySummary.json_legs = itinerarySummary.json_legs.concat(searchResult.itineraries[0].json_legs);
          }
        })
        return itinerarySummary;
      }

      $scope.clearMap = function(index) {
        //clear all elements from the map
        var mapElements = $scope.isWizard ? $scope.wizardMapElements : $scope.mapElements;
        angular.forEach(mapElements, function(element, index) {
          element.setMap(null);
        });
        mapElements.length = 0;
      }


      $scope.selectItinerary = function(index) {
        if(!$scope.filteredItineraries)
          return;
        $scope.clearMap();
        $scope.collapseAccordions();
        var selectedItinerary =  $scope.filteredItineraries[index];
        if($scope.isWizard){
          $scope.wizardSelectedItinerary = selectedItinerary;
          $scope.wizardSelectedItineraryIndex = index
          //copy the location descriptions from the waypoint input boxes
          if($scope.tripPlanningPrefsObject.fromTimeType === 'arrive'){
            selectedItinerary.fromDesc = $scope.waypoints[$scope.wizardSegmentIndex - 1].location;
            selectedItinerary.toDesc = $scope.waypoints[$scope.wizardSegmentIndex].location;
          }else{
            selectedItinerary.fromDesc = $scope.waypoints[$scope.wizardSegmentIndex].location;
            selectedItinerary.toDesc = $scope.waypoints[$scope.wizardSegmentIndex + 1].location;
          }
        }else{
          $scope.selectedItinerary = $scope.filteredItineraries[index];
          $scope.selectedItineraryIndex = index;
        }
        $scope.collapseAccordions();
        //redraw the map
        $scope.renderRouteOnMap($scope.filteredItineraries);
      }

      $scope.selectItinerarySegment = function(index) {
        $scope.collapseAccordions();
        delete $scope.viewport;
        $scope.clearMap();
        $scope.selectedItineraryIndex = index;
        var legLines = [];

        angular.forEach($scope.searchResults, function(searchResult, itineraryIndex){
          var itinerary = searchResult.itineraries[0];
          itinerary.firstSegment = itineraryIndex == 0 ? true : false;
          itinerary.lastSegment = itineraryIndex == $scope.searchResults.length - 1 ? true : false;
        });

        //render the grey routes
        angular.forEach($scope.searchResults, function(searchResult, itineraryIndex){
          //skip the selected itinerary
          if(itineraryIndex === $scope.selectedItineraryIndex){ return; }
          var itinerary = searchResult.itineraries[0];
          angular.forEach(itinerary.json_legs, function(leg, index){
            $scope.generateLeg(leg, index, false, legLines);
          });
        });

        //render the colored route
        angular.forEach($scope.searchResults, function(searchResult, itineraryIndex){
          if(itineraryIndex === $scope.selectedItineraryIndex){
            var itinerary = searchResult.itineraries[0];
            angular.forEach(itinerary.json_legs, function(leg, legIndex){
              var hasOrigin = itineraryIndex == 0 && legIndex == 0;
              var hasDestination = itineraryIndex == $scope.searchResults.length -1 && legIndex == searchResult.itineraries[0].json_legs.length -1;

              var startingWaypointNumber;
              if(!hasOrigin){
                if(legIndex == 0)
                  startingWaypointNumber = itineraryIndex;
              }

              var endingWaypointNumber;
              if(!hasDestination){
                if(legIndex == searchResult.itineraries[0].json_legs.length -1)
                  endingWaypointNumber = itineraryIndex + 1;
              }
              $scope.generateMultiWaypointLeg(leg, true, hasOrigin, hasDestination, startingWaypointNumber, endingWaypointNumber, legLines);
              $scope.viewport = getLegBox(leg, $scope.viewport);

            });
          }
        });

        $scope.selectedItinerary = $scope.searchResults[index].itineraries[0];

        if(index > 0)
          $scope.selectedItinerary.fromIndex = index;
        if(index + 1 < $scope.searchResults.length)
          $scope.selectedItinerary.toIndex = index + 1;

        $scope.selectedItinerary.firstSegment = true;
        $scope.selectedItinerary.lastSegment = true;

        $scope.renderLegLines(legLines);

        var bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng($scope.viewport.maxLat, $scope.viewport.minLon),
            new google.maps.LatLng($scope.viewport.minLat, $scope.viewport.maxLon)
        );
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        routeMap.fitBounds(bounds);

      }

      $scope.selectItinerarySummary = function() {
        $scope.collapseAccordions();
        $scope.selectedItineraryIndex = -1;
        $scope.clearMap();
        $scope.selectedItinerary = $scope.itinerarySummary;
        $scope.renderMultiLegItineraryOnMap();
      }

      /**
      * Update the itinerary page based on refreshed search results.
      */
      $scope.updateItinerary = function(event, result) {
        if($scope.fromTimeType == 'asap')
          $scope.tripPlanningPrefsObject.fromTime = moment().seconds(0).milliseconds(0).toDate();
        $scope.searchResults = result;
        if($scope.isMultiLeg){
          var itinerarySummary = $scope.prepareItinerarySummary(result);
          $scope.itinerarySummary = itinerarySummary;
          $scope.selectedItinerary = $scope.itinerarySummary;
          $scope.searchResults = result;
          $scope.isWizard = false;
          $scope.selectItinerarySummary();
        }else{
          $scope.filterItineraries(null, null, true);
          $scope.selectItinerary(0);
        }
      }

      /**
      * Initialize with the view's tab index in the parent container.
      * Used to listen to this tab's update event.
      */
      $scope.init = function(index, isMultiLeg) {
        $scope.tabIndex = index;
        $scope.tabId = $scope.$parent.resultsTabbed[index].id;
        $scope.isMultiLeg = isMultiLeg;
        $scope.$on('event.itinerary.updateItinerary' + $scope.tabId, $scope.updateItinerary);
      }

      function getLegBox(leg, box){
        box = box || {minLat:null, minLon:null, maxLat:null, maxLon:null};
        if(box.minLat == null || box.minLat > leg.from.lat){
          box.minLat = leg.from.lat;
        }
        if(box.maxLat == null || box.maxLat < leg.from.lat){
          box.maxLat = leg.from.lat;
        }
        if(box.minLon == null || box.minLon > leg.from.lat){
          box.minLon = leg.from.lon;
        }
        if(box.maxLon == null || box.maxLon < leg.from.lon){
          box.maxLon = leg.from.lon;
        }
        if(box.minLat == null || box.minLat > leg.to.lat){
          box.minLat = leg.to.lat;
        }
        if(box.maxLat == null || box.maxLat < leg.to.lat){
          box.maxLat = leg.to.lat;
        }
        if(box.minLon == null || box.minLon > leg.to.lon){
          box.minLon = leg.to.lon;
        }
        if(box.maxLon == null || box.maxLon < leg.to.lon){
          box.maxLon = leg.to.lon;
        }
        return box;
      }

      $scope.generateLeg = function(leg, index, selected, legLines, itineraryIndex){

        var palette = 'secondary';

        if(selected){
          palette = 'primary';
        }

        var routeColors = {
          'primary' : {'walk':'hsl(198, 100%, 50%)', 'bus':'hsl(198, 100%, 50%)',
            'bike':'hsl(198, 100%, 50%)', 'car':'hsl(198, 100%, 50%)' },
          'secondary' : {'walk':'hsla(198, 0%, 50%, .7)', 'bus':'hsla(198, 0%, 50%, .7)',
            'bike':'hsla(198, 0%, 50%, .7)', 'car':'hsla(33, 0%, 50%, .7)' }
        };

        legLines.push({
          geometry: leg.legGeometry.points,
          mode: leg.mode,
          walkColor: routeColors[palette].walk,
          busColor: routeColors[palette].bus,
          bikeColor: routeColors[palette].bike,
          carColor: routeColors[palette].car,
          alerts: leg.alerts,
          itineraryIndex: itineraryIndex
        });

        //Secondary itineraries don't need the markers below (start, end, bus numbers)
        if(!selected){
          return;
        }

        var mapElements = $scope.isWizard ? $scope.wizardMapElements : $scope.mapElements;
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        //show the START marker if this is the first leg. Otherwise show a simple circle (transfer) marker
        var marker;
        if(index == 0){
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.from.lat, leg.from.lon),
            map: routeMap,
            icon: "http://maps.google.com/mapfiles/marker_greenA.png"
          });
        }else{
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.from.lat, leg.from.lon),
            map: routeMap,
            title: leg.mode,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 4,
              strokeWeight: 2,
              fillOpacity: 1,
              fillColor: 'white',
              strokeColor: 'black'
            },
          });
        }
        //push the marker on our stack of elements to be rendered
        mapElements.push(marker);

        //For non-walking legs, show the transit icon and a route number in an InfoBox attached to the marker
        if(leg.mode != 'WALK'){
          var imageUrl = null;
          if(leg.mode == 'BUS'){
            imageUrl = 'images/modes/transit.png';
            legLines[legLines.length-1].busColor = '#'+leg.routeColor;
          }else if(leg.mode == 'TRAM' || leg.mode == 'RAIL'){
            imageUrl = 'images/modes/streetcar.png';
            legLines[legLines.length-1].busColor = '#'+leg.routeColor;
          }else if(leg.mode == 'BICYCLE'){
            imageUrl = 'images/modes/bicycle.png';
          }else if(leg.mode == 'CAR'){
            imageUrl = 'images/modes/auto.png';
          }else{
            alert("found unhandled mode " + leg.mode);
            return;
          }

          var boxText = document.createElement("div");
          boxText.setAttribute("id", "infobox-" + index);
          boxText.style.cssText = "border: 1px solid #81807D; background: white; white-space: nowrap;";
          var routeColor = leg.routeColor ? "#" + leg.routeColor : "white";
          var routeTextColor = leg.routeTextColor ? "#" + leg.routeTextColor : "white";
          var routeShortName = leg.routeShortName ? leg.routeShortName : "";
          boxText.innerHTML =
              '<img src="' + imageUrl + '" style="width: 16px; height: 16px;"/>'+
              '<span style="margin: 0px 1px 0px 2px; position: relative; padding: 0px 4px; color: rgb(255, 255, 255); background-color: ' + routeColor + '; color: ' + routeTextColor + '">' + routeShortName + '</span>'+
              '<img src="http://maps.gstatic.com/mapfiles/tiph.png" draggable="false" style="-webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; position: absolute; right: -7px; top: 17px; width: 15px; height: 9px;"/>';

          var pixelOffset = new google.maps.Size(-50, -25);
          if(leg.mode == 'BICYCLE' || leg.mode == 'CAR')
            pixelOffset = new google.maps.Size(-35, -25);
          var myOptions = {
            pixelOffset: pixelOffset,
            content: boxText
            ,boxStyle: {
              background: "white"
            }
            ,closeBoxURL: ""
          };
          var ib = new InfoBox(myOptions);
          var map = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
          ib.open(map, marker);
          mapElements.push(ib);
        }

        //attach the END marker if this is the last leg
        var selectedItinerary = $scope.isWizard ? $scope.wizardSelectedItinerary : $scope.selectedItinerary;
        if(index == selectedItinerary.json_legs.length - 1){
          var map = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.to.lat, leg.to.lon),
            map: map,
            icon: 'http://maps.google.com/mapfiles/markerB.png'
          });
          mapElements.push(marker);
        }

        marker = $scope.addLegVehicleInfoToRouteMap(leg, routeMap);
        if (marker) {
          //push the marker on our stack of elements to be rendered
          mapElements.push(marker);
        }
      }

      $scope.addLegVehicleInfoToRouteMap = function(leg, routeMap){

        var marker = null;
        if (leg.vehicleInfo != null && leg.vehicleInfo.lat != null & leg.vehicleInfo.lon != null){
          // Add vehicle marker from the leg which has vehicle info.
          // Only one leg of the itinerary will have vehicle info with data, if the itinerary has vehicle info.
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.vehicleInfo.lat, leg.vehicleInfo.lon),
            map: routeMap,
            icon: "images/vehicle.png"
          });

          var contentString = '<div class="vehicle-infowindow">';
          contentString += '<h4>Vehicle Id ' + leg.vehicleInfo.vehicleId + '</h4>';
          contentString += '</div>';

          var infowindow = new google.maps.InfoWindow({
              content: contentString
          });
          google.maps.event.addListener(marker, 'mouseover', function(event) {
            infowindow.setPosition(event.latLng);
            infowindow.open(routeMap, this);
          });
          google.maps.event.addListener(marker, 'mouseout', function(event) {
            infowindow.close();
          });
        }
        return marker;
      }

      $scope.generateMultiWaypointLeg = function(leg, selected, hasOrigin, hasDestination, startingWaypointNumber, endingWaypointNumber, legLines){

        var palette = 'secondary';

        if(selected){
          palette = 'primary';
        }

        var routeColors = {
          'primary' : {'walk':'hsl(198, 100%, 50%)', 'bus':'hsl(198, 100%, 50%)',
            'bike':'hsl(198, 100%, 50%)', 'car':'hsl(198, 100%, 50%)' },
          'secondary' : {'walk':'hsla(198, 0%, 50%, .7)', 'bus':'hsla(198, 0%, 50%, .7)',
            'bike':'hsla(198, 0%, 50%, .7)', 'car':'hsla(33, 0%, 50%, .7)' }
        };

        legLines.push({
          geometry: leg.legGeometry.points,
          mode: leg.mode,
          walkColor: routeColors[palette].walk,
          busColor: routeColors[palette].bus,
          bikeColor: routeColors[palette].bike,
          carColor: routeColors[palette].car
        });

        //Secondary itineraries don't need the markers below (start, end, bus numbers)
        if(!selected){
          return;
        }

        //show the START marker if this is the first leg. Otherwise show a simple circle (transfer) marker
        var marker;
        var mapElements = $scope.isWizard ? $scope.wizardMapElements : $scope.mapElements;
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        if(hasOrigin){
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.from.lat, leg.from.lon),
            map: routeMap,
            icon: "http://maps.google.com/mapfiles/marker_greenA.png"
          });
        }else if(startingWaypointNumber){
          marker = new google.maps.Marker({
            label: {
              text: startingWaypointNumber.toString(),
              color: 'white',
              fontSize: '16px'
            },
            position: new google.maps.LatLng(leg.from.lat, leg.from.lon),
            map: routeMap,
            icon: 'http://maps.google.com/mapfiles/ms/icons/purple.png'
          });
        }else{
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.from.lat, leg.from.lon),
            map: routeMap,
            title: leg.mode,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 4,
              strokeWeight: 2,
              fillOpacity: 1,
              fillColor: 'white',
              strokeColor: 'black'
            },
          });
        }
        //push the marker on our stack of elements to be rendered
        mapElements.push(marker);

        //For non-walking legs, show the transit icon and a route number in an InfoBox attached to the marker
        if(leg.mode != 'WALK'){
          var imageUrl = null;
          if(leg.mode == 'BUS'){
            imageUrl = 'images/modes/transit.png';
            legLines[legLines.length-1].busColor = '#'+leg.routeColor;
          }else if(leg.mode == 'TRAM' || leg.mode == 'RAIL'){
            imageUrl = 'images/modes/streetcar.png';
            legLines[legLines.length-1].busColor = '#'+leg.routeColor;
          }else if(leg.mode == 'BICYCLE'){
            imageUrl = 'images/modes/bicycle.png';
          }else if(leg.mode == 'CAR'){
            imageUrl = 'images/modes/auto.png';
          }else{
            alert("found unhandled mode " + leg.mode);
            return;
          }

          var boxText = document.createElement("div");
          //boxText.setAttribute("id", "infobox-" + index);
          boxText.style.cssText = "border: 1px solid #81807D; background: white; white-space: nowrap;";
          var routeColor = leg.routeColor ? "#" + leg.routeColor : "white";
          var routeTextColor = leg.routeTextColor ? "#" + leg.routeTextColor : "white";
          var routeShortName = leg.routeShortName ? leg.routeShortName : "";
          boxText.innerHTML =
              '<img src="' + imageUrl + '" style="width: 16px; height: 16px;"/>'+
              '<span style="margin: 0px 1px 0px 2px; position: relative; padding: 0px 4px; color: rgb(255, 255, 255); background-color: ' + routeColor + '; color: ' + routeTextColor + '">' + routeShortName + '</span>'+
              '<img src="http://maps.gstatic.com/mapfiles/tiph.png" draggable="false" style="-webkit-user-select: none; border: 0px; padding: 0px; margin: 0px; position: absolute; right: -7px; top: 17px; width: 15px; height: 9px;"/>';

          var pixelOffset = new google.maps.Size(-50, -25);
          if(leg.mode == 'BICYCLE' || leg.mode == 'CAR')
            pixelOffset = new google.maps.Size(-35, -25);
          var myOptions = {
            pixelOffset: pixelOffset,
            content: boxText
            ,boxStyle: {
              background: "white"
            }
            ,closeBoxURL: ""
          };
          var ib = new InfoBox(myOptions);
          ib.open(routeMap, marker);
          mapElements.push(ib);
        }

        //attach the END marker if this is the last leg
        if(hasDestination){
          marker = new google.maps.Marker({
            position: new google.maps.LatLng(leg.to.lat, leg.to.lon),
            map: routeMap,
            icon: 'http://maps.google.com/mapfiles/markerB.png'
          });
          mapElements.push(marker);
        }else if(endingWaypointNumber){
          marker = new google.maps.Marker({
            label: {
              text: endingWaypointNumber.toString(),
              color: 'white',
              fontSize: '16px'
            },
            position: new google.maps.LatLng(leg.to.lat, leg.to.lon),
            map: routeMap,
            icon: 'http://maps.google.com/mapfiles/ms/icons/purple.png'
          });
          mapElements.push(marker);
        }
      }

      $scope.fixWindow = function(infowindow){
        google.maps.event.addListener(infowindow, 'domready', function() {
          var width = $('#' + this.content_.id).width();
          var height = $('#' + this.content_.id).height();
          infowindow.setOptions({
            pixelOffset: new google.maps.Size(-width - 10, -height - 10),
          })
        });
      }

      $scope.collapseAccordions = function(){
        $('.in.animate-show').removeClass('in')
      }


      $scope.renderRouteOnMap = function(filteredItineraries){
        if(filteredItineraries && filteredItineraries.length == 0)
          return;
        var legLines = [];
        var selectedItineraryIndex = $scope.isWizard ? $scope.wizardSelectedItineraryIndex : $scope.selectedItineraryIndex;
        if(!selectedItineraryIndex)
          selectedItineraryIndex = 0;
        var selectedItinerary = $scope.isWizard ? $scope.wizardSelectedItinerary : $scope.selectedItinerary;
        //generate the non-selected legs first, with the secondary color (this will ensure the selected route shows on top)
        var itineraries = filteredItineraries ? filteredItineraries : $scope.searchResults.itineraries;
        angular.forEach(itineraries, function(itinerary, itineraryIndex){
          //skip the selected itinerary
          if(itineraryIndex === selectedItineraryIndex){ return; }
          angular.forEach(itinerary.json_legs, function(leg, index){
            $scope.generateLeg(leg, index, false, legLines, itineraryIndex);
          });
        });

        //generate the selected itinerary lines using the primary color palette
        angular.forEach(selectedItinerary.json_legs, function(leg, index){
          $scope.generateLeg(leg, index, true, legLines, selectedItineraryIndex);
        });
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        var bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng($scope.viewport.maxLat, $scope.viewport.minLon),
            new google.maps.LatLng($scope.viewport.minLat, $scope.viewport.maxLon)
        );
        routeMap.fitBounds(bounds);

        $scope.renderLegLines(legLines);
      }

      $scope.renderLegLines = function(legLines){
        var mapElements = $scope.isWizard ? $scope.wizardMapElements : $scope.mapElements;
        var lineSymbol = {
          path: google.maps.SymbolPath.CIRCLE,
          fillOpacity: 1,
          scale: 3
        };

        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;

        angular.forEach(legLines, function(legLine, index) {
          var coordinates = google.maps.geometry.encoding.decodePath(legLine.geometry);
          var poly;
          if(legLine.mode.toLowerCase() == 'walk'){
            poly = new google.maps.Polyline({
              strokeColor: legLine.walkColor,
              strokeOpacity: 0,
              fillOpacity: 0,
              icons: [{
                icon: lineSymbol,
                offset: '0',
                repeat: '10px'
              }],
              map: routeMap
            });
          } else if(legLine.mode.toLowerCase() == 'bicycle'){
            poly = new google.maps.Polyline({
              strokeColor: legLine.bikeColor,
              strokeOpacity: 1,
              strokeWeight: 5,
              map: routeMap
            });
          } else if(legLine.mode.toLowerCase() == 'car') {
            poly = new google.maps.Polyline({
              strokeColor: legLine.carColor,
              strokeOpacity: 1,
              strokeWeight: 5,
              map: routeMap
            });
          }else{
            poly = new google.maps.Polyline({
              strokeColor: legLine.busColor,
              strokeOpacity: 1,
              strokeWeight: 5,
              map: routeMap
            });
          }
          angular.forEach(coordinates, function(coordinate, index) {
            poly.getPath().push(coordinate);
          });
          mapElements.push(poly);
          poly.itineraryIndex = legLine.itineraryIndex
          google.maps.event.addListener(poly, 'click', function(h) {
            $scope.selectItinerary(poly.itineraryIndex);
          });

          $scope.addAlertsInfoWindowToLegLine(legLine, routeMap, poly);
        });
      }

     $scope.addAlertsInfoWindowToLegLine = function(legLine, routeMap, poly){
          var contentString = '<div class="leg--infowindow">';
          angular.forEach(legLine.alerts, function(alert, index){
            contentString += '<h4 class="leg--warning">' + alert.alertHeaderText + '</h4>';
            if(alert.alertDescriptionText)
            {
                contentString +='<p>' + alert.alertDescriptionText + '</p>';
            }
          });
          contentString += '</div>';

          if (legLine.alerts != null && legLine.alerts.length > 0) {
            var infowindow = new google.maps.InfoWindow({
                content: contentString
            });
            google.maps.event.addListener(poly, 'mouseover', function(event) {
              infowindow.setPosition(event.latLng);
              infowindow.open(routeMap, this);
            });
            google.maps.event.addListener(poly, 'mouseout', function(event) {
              infowindow.close();
            });
          }
     }

      $scope.zoomLeg = function($event, index){
        var bounds, box;
        var selectedItinerary = $scope.isWizard ? $scope.wizardSelectedItinerary : $scope.selectedItinerary;
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        box = getLegBox( selectedItinerary.json_legs[index] );
        bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(box.maxLat, box.minLon),
            new google.maps.LatLng(box.minLat, box.maxLon)
        );

        routeMap.setZoom(16);
        routeMap.panToBounds( bounds );
      }

      $scope.renderMultiLegItineraryOnMap = function(){

        if($scope.searchResults && $scope.searchResults == 0)
          return;

        delete $scope.viewport;
        var legLines = [];

        $scope.json_legs = [];

        angular.forEach($scope.searchResults, function(searchResult, itineraryIndex){
          //generate the selected itinerary lines using the primary color palette
          angular.forEach(searchResult.itineraries[0].json_legs, function(leg, legIndex){
            var hasOrigin = itineraryIndex == 0 && legIndex == 0;
            var hasDestination = itineraryIndex == $scope.searchResults.length -1 && legIndex == searchResult.itineraries[0].json_legs.length -1;

            var startingWaypointNumber;
            if(!hasOrigin){
              if(legIndex == 0)
                startingWaypointNumber = itineraryIndex;
            }

            var endingWaypointNumber;
            if(!hasDestination){
              if(legIndex == searchResult.itineraries[0].json_legs.length -1)
                endingWaypointNumber = itineraryIndex + 1;
            }
            $scope.generateMultiWaypointLeg(leg, true, hasOrigin, hasDestination, startingWaypointNumber, endingWaypointNumber, legLines);
            $scope.viewport = getLegBox(searchResult.itineraries[0].json_legs[legIndex], $scope.viewport);
            $scope.json_legs.push(leg);
          });
        });

        var bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng($scope.viewport.maxLat, $scope.viewport.minLon),
            new google.maps.LatLng($scope.viewport.minLat, $scope.viewport.maxLon)
        );
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        routeMap.fitBounds(bounds);


        var lineSymbol = {
          path: google.maps.SymbolPath.CIRCLE,
          fillOpacity: 1,
          scale: 3
        };

        angular.forEach(legLines, function(legLine, index) {
          var mapElements = $scope.isWizard ? $scope.wizardMapElements : $scope.mapElements;
          var coordinates = google.maps.geometry.encoding.decodePath(legLine.geometry);
          var poly;
          if(legLine.mode.toLowerCase() == 'walk'){
            poly = new google.maps.Polyline({
              strokeColor: legLine.walkColor,
              strokeOpacity: 0,
              fillOpacity: 0,
              icons: [{
                icon: lineSymbol,
                offset: '0',
                repeat: '10px'
              }],
              map: routeMap
            });
          } else if(legLine.mode.toLowerCase() == 'bicycle'){
            poly = new google.maps.Polyline({
              strokeColor: legLine.bikeColor,
              strokeOpacity: 1,
              strokeWeight: 5,
              map: routeMap
            });
          } else if(legLine.mode.toLowerCase() == 'car') {
            poly = new google.maps.Polyline({
              strokeColor: legLine.carColor,
              strokeOpacity: 1,
              strokeWeight: 5,
              map: routeMap
            });
          }else{
            poly = new google.maps.Polyline({
              strokeColor: legLine.busColor,
              strokeOpacity: 1,
              strokeWeight: 5,
              map: routeMap
            });
          }
          angular.forEach(coordinates, function(coordinate, index) {
            poly.getPath().push(coordinate);
          });
          mapElements.push(poly);
        });
      }

      $scope.filterItineraries = function(n, k, init){

        if(n == k && !init)
            return;

        var itinerariesToSort;
        if($scope.isWizard){
          itinerariesToSort = $scope.modalSearchResults.itineraries;
        }else{
          itinerariesToSort = $scope.searchResults.itineraries
        }

        var selectedItinerary = $scope.isWizard ? $scope.wizardSelectedItinerary : $scope.selectedItinerary;

        var previousSelectedItineraryId;
        if(selectedItinerary)
          previousSelectedItineraryId = selectedItinerary.id;

        //first sort the array using a sorter generated
        var sorter = itinerarySorter($scope.routesSortBy);
        itinerariesToSort.sort( sorter );

        //filter the subset based on additional filters criteria
        $scope.filteredItineraries = itinerariesToSort.filter( function(itinerary)
        {
          var include = true;
          if(itinerary.wait_time > $scope.transferSlider.value){
            include = false;
          }
          if(itinerary.walk_distance > $scope.walkSlider.value){
            include = false;
          }
          var bikeDistance = 0;
          itinerary.json_legs.forEach(function(leg, key){
            if(leg.mode == 'BICYCLE'){
              bikeDistance += leg.distance;
            }
          })
          if(bikeDistance.toFixed(0) > $scope.bikeSlider.value.toFixed(0)){
            include = false;
          }
          return include;
        });

        //finally, limit the results to the number requested
        $scope.filteredItineraries = $scope.filteredItineraries.slice(0, $scope.routesToShow);

        //update the map
        $scope.clearMap();
        var mapElements = $scope.isWizard ? $scope.wizardMapElements : $scope.mapElements;
        mapElements.length = 0;

        if(previousSelectedItineraryId){
          for(var i = 0; i < $scope.filteredItineraries.length; i++){
            if($scope.filteredItineraries[i].id == previousSelectedItineraryId){
              $scope.selectItinerary(i);
              return;
            }
          }
        }

        $scope.selectItinerary(0);
      }

      $scope.emailTripPlan = function() {
          $modal.open({
              templateUrl: 'views/email-form.html',
              controller: ['$scope', '$modalInstance', '$http', '$filter', 'usSpinnerService', 'flash', 'planService', 'fromName', 'toName', 'fromDate', 'fromTime', 'trip', EmailModalController],
              resolve: {
                planService: function () { return planService; },
                fromName: function () { return $scope.fromDetails.formatted_address; },
                toName: function () { return $scope.toDetails.formatted_address; },
                fromDate: function () { return $scope.fromDate; },
                fromTime: function () { return $scope.fromTime; },
                trip: function () {
                  var trip = {
                    id: $scope.searchResults.trip_id,
                    itineraries: [ $scope.selectedItinerary ]
                  };
                  return trip;
                }
              }
          });
      }

      $scope.handleBoundary = function(){
        if(planService.polygon){
            if (!$scope.loadedBoundary) {
              // Reuse boundary data that should have already been fetched for trip planning map.
              var data = planService.polygon;
              $scope.addBoundaryToMap(data);
              $scope.loadedBoundary = true;
            }
            return;
        }

        $http.get('/api/v1/places/boundary').
        success(function(data) {

            planService.polygon = data;

            $scope.addBoundaryToMap(data);
            $scope.loadedBoundary = true;
        });

        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        mapLayerService.addAllLayersToMap(routeMap, $scope.mapLayersById);
        $scope.addMapLayerToggleToMap(routeMap);
      }

      $scope.addBoundaryToMap = function(data) {
        // The itinerary map bounds are smaller than the service boundary, so using the trip planning map bounds
        // instead to ensure service boundary is the inner polygon.
        var featureCollection = planService.createFeatureCollection (data);
        var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
        routeMap.data.addGeoJson(featureCollection);
        routeMap.data.setStyle(function (feature) {
          return {
            fillOpacity: "0.2",
            strokeWeight: "1"
          };
        });
      }

      $scope.addMapLayerToggleToMap = function(map) {
          var controlDiv = document.createElement('div');
          var controlUI = document.getElementById("mapLayerCheckboxes");
          controlDiv.appendChild(controlUI);

          controlDiv.index = 1;
          map.controls[google.maps.ControlPosition.TOP_CENTER].push(controlDiv);
      }

      $scope.toggleMapLayer = function(event) {
          var routeMap = $scope.isWizard ? $scope.wizardRouteMap : $scope.routeMap;
          mapLayerService.toggleMapLayer(routeMap, $scope.mapLayersById, event.target.id, event.target.checked);
      }

      var itinerarySorter = function(key, direction)
      {
        //return a sorter function which sorts on 'key' (as int) by 'direction'
        var lt, gt, parser;
        var dateFields = ['end_time', "start_time"];
        var fareFields = ['fare'];
        if('desc' === direction){
          lt=1;
          gt=-1;
        }else{
          lt=-1;
          gt=1;
        }
        if( -1 < dateFields.indexOf(key) ){
          parser = function(input){ return new Date(input); }
        } else if (-1 < fareFields.indexOf(key)) {
          parser = function(input){ 
            if (input != null && input['fare'] != null && input['fare']['regular'] != null && input['fare']['regular']['cents'] != null) {
              return parseInt(input['fare']['regular']['cents']); 
            } else {
              return 0;
            }
          }
        }else{
          parser = function(input){ return parseInt(input); }
        }
        var sorter = function(a, b){
          var aa = parser( a[key] );
          var bb = parser( b[key] );
          if (aa < bb){
            return lt;
          }else if (aa > bb){
            return gt;
          }else{
            return 0;
          }
        }
        return sorter;
      }

      //de-activate the active tab, activate this (:last) tab
      $('#tab-container .tab-pane.active, #main-nav-tabs li.active').removeClass('active');
      $('#tab-container .tab-pane:last, #main-nav-tabs li:last').addClass('active');

    }


  ]);

var EmailModalController = function($scope, $modalInstance, $http, $filter, usSpinnerService, flash, planService, fromName, toName, fromDate, fromTime, trip) {

  $scope.fromName = planService.waypoints[0].location;
  $scope.toName = planService.waypoints[ (planService.waypoints.length - 1) ].location;
  $scope.fromDate = fromDate;
  $scope.fromTime = fromTime;
  $scope.trip = trip;
  $scope.emailAddresses = '';

  $scope.createSubjectLine = function(){
    return "RTD itinerary " + $scope.fromName + " to " + $scope.toName + ", " +
      $filter('date')($scope.fromTime, 'shortTime') + ", " +
      $filter('date')($scope.fromDate, 'shortDate');
  }
  $scope.subjectLine = $scope.createSubjectLine();

  $scope.closeModal = function(){
     $modalInstance.close();
  }

  $scope.submitEmail = function(){
    if ($scope.validateForm()) {
     $scope.sendEmail();
     $scope.closeModal();
   }
  }

  $scope.validateForm = function() {
    var valid = true;
    var result = planService.validateEmail($scope.emailAddresses);
    if (result) {
        $('#emailAddressesError').hide();
        $('#ef-email-addresses textarea').removeClass('ng-invalid');
    }else{
        $('#emailAddressesError').show();
        $('#ef-email-addresses textarea').addClass('ng-invalid');
        valid = false;
    }

    if ($scope.subjectLine) {
        $('#subjectError').hide();
        $('#ef-subject-line textarea').removeClass('ng-invalid');
    }else{
        $('#subjectError').show();
        $('#ef-subject-line textarea').addClass('ng-invalid');
        valid = false;
    }

    return valid;
  }

  $scope.sendEmail = function() {
    var trip = $scope.trip;
    trip.emailString = $scope.emailAddresses;

    if(trip.emailString){
      var result = planService.validateEmail(trip.emailString);
      if(result == true){
        var addresses = trip.emailString.split(/[ ,;]+/);

        var itineraries = [];
        
        if (Array.isArray(planService.searchResults)) { // isMultiLeg
          angular.forEach(planService.searchResults, function(searchResult, index) {
            itineraries.push({"id": searchResult.itineraries[0].id.toString()})
          });
        }
        else {
          angular.forEach(trip.itineraries, function(itinerary, index) {
            itineraries.push({"id":itinerary.id.toString()})
          });
        }

        var emailRequest = {
          email_itineraries: [
            {
              email_addresses: addresses,
              itineraries: itineraries,
              subjectLine: $scope.subjectLine
            }
          ]
        }

        usSpinnerService.spin('spinner-1');

        var promise = planService.emailItineraries($http, emailRequest);

        promise.success(function(result) {
          flash.setMessage('Your email was sent.');
          usSpinnerService.stop('spinner-1');
        }).error(function() {
          bootbox.alert("An error occurred on the server. Your email was not sent.");
          usSpinnerService.stop('spinner-1');
        });

      }else{
        bootbox.alert("Email validation failed. Your email was not sent.");
      }
    } else {
      bootbox.alert("No email address was entered. Your email was not sent.");
    }
  }
}
