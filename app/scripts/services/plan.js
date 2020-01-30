'use strict';


angular.module('applyMyRideApp')
    .service('planService', function() {

          this.reset = function(){
            delete this.fromDate;
            delete this.fromTime;
            delete this.fromTimeType;
            delete this.waypoints;
            delete this.returnDate;
            delete this.returnTime;
            delete this.returnTimeType;
            delete this.numberOfCompanions;
            delete this.hasEscort;
            delete this.driverInstructions;
            delete this.allowDeparturesTime;
          }

            this.setRealTimeData = function(leg){

                if(leg.realTime){
                    leg.scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                    leg.realStartTime = leg.startTime;
                    leg.scheduledEndTime = moment(leg.endTime).subtract(leg.arrivalDelay, 'seconds').valueOf();
                    leg.realEndTime = leg.endTime;
                }else{
                    leg.scheduledStartTime = leg.startTime;
                    leg.scheduledEndTime = leg.endTime;
                }

                for(var i = 0; i < leg.intermediateStops.length; i+=1){
                    var stop = leg.intermediateStops[i];
                    if(stop.realtime){
                        stop.scheduledEndTime = moment(stop.arrival).subtract(stop.arrivalDelay, 'seconds').valueOf();
                        stop.realEndTime = stop.arrival;
                        stop.scheduledDepartTime = stop.departure;
                    }else{
                        stop.scheduledEndTime = stop.arrival;
                    }
                }

                return leg;
            }

        this.setBusRailDepartures = function(itinerary){
            var haveBus = false;
            for(var i = 0; i < itinerary.json_legs.length; i+=1){
                if(!haveBus && 'BUS' === itinerary.json_legs[i].mode){
                    haveBus = true;
                    var leg = itinerary.json_legs[i];
                    if(leg.realTime){
                        var scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                        itinerary.bus_depart = scheduledStartTime;
                        itinerary.real_bus_depart = leg.startTime;
                    }else{
                        itinerary.bus_depart = leg.startTime;
                    }
                }else if(!haveBus && ('TRAM' === itinerary.json_legs[i].mode || 'RAIL' === itinerary.json_legs[i].mode)){
                    haveBus = true;

                    var leg = itinerary.json_legs[i];
                    if(leg.realTime){
                        var scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                        itinerary.rail_depart = scheduledStartTime;
                        itinerary.real_rail_depart = leg.startTime;
                    }else{
                        itinerary.rail_depart = leg.startTime;
                    }
                }
            }
        }
            this.setBusRailDepartures = function(itinerary){
                var haveBus = false;
                for(var i = 0; i < itinerary.json_legs.length; i+=1){
                    if(!haveBus && 'BUS' === itinerary.json_legs[i].mode){
                        haveBus = true;
                        var leg = itinerary.json_legs[i];
                        if(leg.realTime){
                            var scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                            itinerary.bus_depart = scheduledStartTime;
                            itinerary.real_bus_depart = leg.startTime;
                        }else{
                            itinerary.bus_depart = leg.startTime;
                        }
                    }else if(!haveBus && ('TRAM' === itinerary.json_legs[i].mode || 'RAIL' === itinerary.json_legs[i].mode)){
                        haveBus = true;

                        var leg = itinerary.json_legs[i];
                        if(leg.realTime){
                            var scheduledStartTime = moment(leg.startTime).subtract(leg.departureDelay, 'seconds').valueOf();
                            itinerary.rail_depart = scheduledStartTime;
                            itinerary.real_rail_depart = leg.startTime;
                        }else{
                            itinerary.rail_depart = leg.startTime;
                        }
                    }
                }
            }

          this.emailItineraries = function($http, emailRequest){
            return $http.post('api/v1/itineraries/email', emailRequest, this.getHeaders())
          }

          this.validateEmail = function(emailString){
            var addresses = emailString.split(/[ ,;]+/);
            var valid = true;
            var that = this;
            angular.forEach(addresses, function(address, index) {
              var result = that.validateEmailAddress(address);
              if(result == false){
                valid = false;
              }
            });
            return valid;
          }

          this.validateEmailAddress = function(email) {
            var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
            return re.test(email);
          }

          this.getSynonyms = function($http, $scope) {
            var that = this;
            return $http.get('api/v1/places/synonyms', this.getHeaders()).
            success(function(data) {
              $scope.synonyms = data ? data : {};
            })
          }

        this.getBlacklist = function($http, $scope) {
            var that = this;
            return $http.get('api/v1/places/blacklist', this.getHeaders()).
            success(function(data) {
                $scope.blacklist = data ? data : {};
            })
        }

        this.getDefaults = function($http, $scope, isEdit) {
            if(isEdit)
                return;
            var that = this;
            return $http.get('api/v1/internal/defaults', this.getHeaders()).
            success(function(data) {

                $scope.priority = data.priority;
                $scope.includeRoutes = data.includeRoutes;
                $scope.excludeRoutes = data.excludeRoutes;
                $scope.transitOnlyMode = data.transitOnlyMode == 'true';
                $scope.busOnlyMode = data.busOnlyMode == 'true';
                $scope.railOnlyMode = data.railOnlyMode == 'true';
                $scope.walkOnlyMode = data.walkOnlyMode == 'true';
                $scope.bikeOnlyMode = data.bikeOnlyMode == 'true';
                $scope.parkAndRideMode = data.parkAndRideMode == 'true';
                $scope.bikeTransitMode = data.bikeTransitMode == 'true';
                $scope.maxWalkTime = parseFloat(data.maxWalkTime);
                $scope.maxWalkDistance = parseFloat(data.maxWalkDistance);
                $scope.maxWalkPace = data.maxWalkPace;
                $scope.maxBikeTime = parseFloat(data.maxBikeTime);
                $scope.maxBikeDistance = parseFloat(data.maxBikeDistance);
                $scope.maxBikePace = data.maxBikePace;
                $scope.minTransferTime = parseFloat(data.minTransferTime);
                $scope.maxTransferTime = parseFloat(data.maxTransferTime);
                $scope.allowDeparturesTime = parseFloat(data.allowDeparturesTime);
                $scope.tripShownRangeTime = parseFloat(data.tripShownRangeTime ? data.tripShownRangeTime : 3);
                $scope.tripRangeTimeSlider = parseFloat(data.tripRangeTimeSlider);
                $scope.defaultPosition = new google.maps.LatLng(parseFloat(data.defaultPosition.split(',')[0]), parseFloat(data.defaultPosition.split(',')[1]));
                $scope.defaultLayoverTime = parseFloat(data.defaultLayoverTime);
                $scope.showRealtime = data.showRealtime === 'true';
                $scope.routesToShow = Number(data.routesToShow) ? Number(data.routesToShow) : 3;

                var now = new Date().valueOf();
                if(isEdit != true){
                    $scope.waypoints.push({
                        id: now,
                        name: '',
                        layoverTime: $scope.defaultLayoverTime,
                        locationDetails: that.fromDetails,
                        location: $scope.from
                    });
                    $scope.waypoints.push({
                        id: now + 1,
                        name: '',
                        layoverTime: $scope.defaultLayoverTime,
                        locationDetails: that.toDetails,
                        location: $scope.to
                    });
                }
            })
        }


        /**
          * Retain a copy of the original trip planning preferences to make it easier to pass along to itinerary scope.
          */
          this.copyTripPlanningPrefs = function($scope) {
            var tripPlanningPrefsObject = {};
            tripPlanningPrefsObject.waypoints = angular.copy($scope.waypoints, []);
            tripPlanningPrefsObject.fromTimeType = $scope.fromTimeType;
            tripPlanningPrefsObject.fromTime = $scope.fromTime;
            tripPlanningPrefsObject.fromDate = $scope.fromDate;
            tripPlanningPrefsObject.priority = $scope.priority;
            tripPlanningPrefsObject.includeRoutes = $scope.includeRoutes;
            tripPlanningPrefsObject.excludeRoutes = $scope.excludeRoutes;
            tripPlanningPrefsObject.transitOnlyMode = $scope.transitOnlyMode;
            tripPlanningPrefsObject.busOnlyMode = $scope.busOnlyMode;
            tripPlanningPrefsObject.railOnlyMode = $scope.railOnlyMode;
            tripPlanningPrefsObject.walkOnlyMode = $scope.walkOnlyMode;
            tripPlanningPrefsObject.bikeOnlyMode = $scope.bikeOnlyMode;
            tripPlanningPrefsObject.parkAndRideMode = $scope.parkAndRideMode;
            tripPlanningPrefsObject.bikeTransitMode = $scope.bikeTransitMode;
            tripPlanningPrefsObject.maxWalkTime = $scope.maxWalkTime;
            tripPlanningPrefsObject.maxWalkDistance = $scope.maxWalkDistance;
            tripPlanningPrefsObject.maxWalkPace = $scope.maxWalkPace;
            tripPlanningPrefsObject.maxBikeTime = $scope.maxBikeTime;
            tripPlanningPrefsObject.maxBikeDistance = $scope.maxBikeDistance;
            tripPlanningPrefsObject.maxBikePace = $scope.maxBikePace;
            tripPlanningPrefsObject.minTransferTime = $scope.minTransferTime;
            tripPlanningPrefsObject.maxTransferTime = $scope.maxTransferTime;
            tripPlanningPrefsObject.allowDeparturesTime = $scope.allowDeparturesTime;
            tripPlanningPrefsObject.tripShownRangeTime= $scope.tripShownRangeTime;
            tripPlanningPrefsObject.tripRangeTimeSlider = $scope.tripRangeTimeSlider;
            //because the date/time changes for multileg trips, hold on to the initial search values
            tripPlanningPrefsObject.initialFromDate = $scope.initialFromDate;
            tripPlanningPrefsObject.initialFromTime = $scope.initialFromTime;
            this.tripPlanningPrefsObject = tripPlanningPrefsObject;
          }

          this.prepareItineraryRequestObject = function($scope, waypointIndex, reverseOrder) {
            this.allowDeparturesTime = $scope.allowDeparturesTime;
            var waypoints = $scope.tripPlanningPrefsObject ? $scope.tripPlanningPrefsObject.waypoints : this.waypoints;
            var request = this.createItineraryRequest(waypoints, waypointIndex, reverseOrder, $scope);
            this.itineraryRequestObject = request;
            this.copyTripPlanningPrefs($scope);

            this.prepareModesRequestParameter($scope, request);
            request.max_walk_miles = $scope.maxWalkDistance;
            request.max_bicycle_miles = $scope.maxBikeDistance;

            request.min_transfer_time_hard = $scope.minTransferTime * 60;
            request.max_transfer_time = $scope.maxTransferTime * 60;
            request.trip_shown_range_time=$scope.tripShownRangeTime * 60 * 60;

            if($scope.includeRoutes){
                var preferred_routes = $scope.includeRoutes.split(/[ ,;]+/);
                request.preferred_routes = [];
                for(var i = 0; i < preferred_routes.length; i++){
                    request.preferred_routes.push({"short_name": preferred_routes[i]});
                }
            }

            if($scope.excludeRoutes){
              var banned_routes = $scope.excludeRoutes.split(/[ ,;]+/);
              request.banned_routes = [];
              for(var i = 0; i < banned_routes.length; i++){
                  request.banned_routes.push({"short_name": banned_routes[i]});
              }
            }

            var fromLocationDescription = this.getAddressDescriptionFromLocation(request.itinerary_request[0].start_location);
            request.fromLine1 = fromLocationDescription.line1;
            request.fromLine2 = fromLocationDescription.line2;

            var toLocationDescription = this.getAddressDescriptionFromLocation(request.itinerary_request[0].end_location);
            request.toLine1 = toLocationDescription.line1;
            request.toLine2 = toLocationDescription.line2;

            var outboundTime = request.itinerary_request[0].trip_time;
            request.when1 = this.getDateDescription(outboundTime);
            request.when2 = (request.itinerary_request[0].departure_type == 'depart' ? "Start out at " : "Arrive by ") + moment(outboundTime).format('h:mm a');
            $scope.request = request;
          }

          this.prepareModesRequestParameter = function($scope, request) {
            request.modes = [];
            if ($scope.transitOnlyMode) {
              request.modes.push('mode_transit');
            }
            if ($scope.busOnlyMode) {
              request.modes.push('mode_bus');
            }
            if ($scope.railOnlyMode) {
              request.modes.push('mode_rail');
            }
            if ($scope.walkOnlyMode) {
              request.modes.push('mode_walk');
            }
            if ($scope.bikeOnlyMode) {
              request.modes.push('mode_bicycle');
            }
            if ($scope.parkAndRideMode) {
              request.modes.push('mode_park_transit');
            }
            if ($scope.bikeTransitMode) {
              request.modes.push('mode_bicycle_transit');
            }
          }



          this.setItineraryDescriptions = function(itinerary, result){
            itinerary.startDesc = this.getDateDescription(itinerary.start_time);
            itinerary.startDesc += " at " + moment(itinerary.start_time).format('h:mm a')
            itinerary.endDesc = this.getDateDescription(itinerary.end_time);
            itinerary.endDesc += " at " + moment(itinerary.end_time).format('h:mm a');
            itinerary.travelTime = humanizeDuration(itinerary.duration * 1000,  { units: ["hours", "minutes"], round: true });
            itinerary.walkTimeDesc = humanizeDuration(itinerary.walk_time * 1000,  { units: ["hours", "minutes"], round: true });
            itinerary.dayAndDateDesc = moment(itinerary.start_time).format('dddd, MMMM Do');
            itinerary.startTimeDesc = moment(itinerary.start_time).format('h:mm a');
            itinerary.endTimeDesc = moment(itinerary.end_time).format('h:mm a');
            itinerary.distanceDesc = ( itinerary.distance * 0.000621371 ).toFixed(2);
            itinerary.walkDistanceDesc = ( itinerary.walk_distance * 0.000621371 ).toFixed(2);



            if(itinerary.json_legs){
                var itineraryWarnings = [];
                var metersToMiles = 0.000621371;
                var foundFirstTransitLeg = false;
                for(var i = 0; i < itinerary.json_legs.length; i++){
                    var leg = itinerary.json_legs[i];
                    delete leg.warning;


                    if (leg.alerts) {
                        for(var j = 0; j < leg.alerts.length; j++){
                            if (leg.warning) {
                                leg.warning = leg.warning + "\n" + leg.alerts[j].alertHeaderText;
                            } else {
                                leg.warning = leg.alerts[j].alertHeaderText;
                            }
                        }

                    }

                    if(leg.mode == 'CAR'){

                        if (result.alerts){
                            if(result.alerts.mode_car != undefined && result.alerts.mode_car.length > 0) {
                                if(itineraryWarnings.indexOf(result.alerts.mode_car[0].alertHeaderText) < 0){
                                    itineraryWarnings.push(result.alerts.mode_car[0].alertHeaderText);
                                }
                            }
                        }
                    }

                    if((leg.mode == 'BUS' || leg.mode == 'TRAM' || leg.mode == 'RAIL') && leg.from.vertexType == 'TRANSIT'){

                        if (result.alerts){
                            if(result.alerts.mode_transit != undefined && result.alerts.mode_transit.length > 0 ||
                                result.alerts.mode_bicycle_transit != undefined && result.alerts.mode_bicycle_transit.length > 0 ||
                                result.alerts.mode_park_transit != undefined && result.alerts.mode_park_transit.length > 0 ||
                                result.alerts.mode_bike_park_transit != undefined && result.alerts.mode_bike_park_transit.length > 0 ||
                                result.alerts.mode_rail != undefined && result.alerts.mode_rail.length > 0 ||
                                result.alerts.mode_bus != undefined && result.alerts.mode_bus.length > 0
                            ) {
                                if(result.alerts.mode_transit != undefined && result.alerts.mode_transit.length > 0) {
                                    if(itineraryWarnings.indexOf(result.alerts.mode_transit[0].alertHeaderText) < 0){
                                        itineraryWarnings.push(result.alerts.mode_transit[0].alertHeaderText);
                                    }
                                }
                                if(result.alerts.mode_bicycle_transit != undefined && result.alerts.mode_bicycle_transit.length > 0) {
                                    if(itineraryWarnings.indexOf(result.alerts.mode_bicycle_transit[0].alertHeaderText) < 0){
                                        itineraryWarnings.push(result.alerts.mode_bicycle_transit[0].alertHeaderText);
                                    }
                                }
                                if(result.alerts.mode_park_transit != undefined && result.alerts.mode_park_transit.length > 0) {
                                    if(itineraryWarnings.indexOf(result.alerts.mode_park_transit[0].alertHeaderText) < 0){
                                        itineraryWarnings.push(result.alerts.mode_park_transit[0].alertHeaderText);
                                    }
                                }
                                if(result.alerts.mode_bike_park_transit != undefined && result.alerts.mode_bike_park_transit.length > 0) {
                                    if(itineraryWarnings.indexOf(result.alerts.mode_bike_park_transit[0].alertHeaderText) < 0){
                                        itineraryWarnings.push(result.alerts.mode_bike_park_transit[0].alertHeaderText);
                                    }
                                }
                                if(result.alerts.mode_rail != undefined && result.alerts.mode_rail.length > 0) {
                                    if(itineraryWarnings.indexOf(result.alerts.mode_rail[0].alertHeaderText) < 0){
                                        itineraryWarnings.push(result.alerts.mode_rail[0].alertHeaderText);
                                    }
                                }
                                if(result.alerts.mode_bus != undefined && result.alerts.mode_bus.length > 0) {
                                    if(itineraryWarnings.indexOf(result.alerts.mode_bus[0].alertHeaderText) < 0) {
                                        itineraryWarnings.push(result.alerts.mode_bus[0].alertHeaderText);
                                    }
                                }
                            }
                        }

                        itinerary.hasNext = true;
                        if(leg.from.nextDeparture){
                            leg.nextDepartureTime = moment.unix(leg.from.nextDeparture).toDate();
                            var minutesTilNext = moment.unix(leg.from.nextDeparture).diff( moment(leg.from.departure)) / 1000 / 60;
                            if(minutesTilNext > 120){
                                itinerary.hasNext = false;
                                leg.hasNext = false;
                            }else{
                                leg.hasNext = true;
                            }
                        }
                    }

                    if(i == 0)
                        continue;

                    var previousLeg = itinerary.json_legs[i - 1];

                    if(leg.transitLeg && foundFirstTransitLeg){
                        var transferTimeInMins = (leg.startTime - previousLeg.endTime) / 1000 / 60;
                        var timeDiff = leg.startTime - previousLeg.endTime;
                        var units = timeDiff / 1000 >= 60 ? "minutes" : "seconds";
                        if(this.tripPlanningPrefsObject.fromTimeType == 'depart'){
                            //'arrive by' trips will have the walk leg arrive just before the transfer, ignore those
                            if(transferTimeInMins < this.tripPlanningPrefsObject.minTransferTime){
                                itineraryWarnings.push("This itinerary includes transfers with times below your minimum preference.");
                                leg.warning = "This transfer wait time is approximately " + humanizeDuration(timeDiff,  { units: [units], round: true });
                                break;
                            }
                        }
                        if(transferTimeInMins > this.tripPlanningPrefsObject.maxTransferTime){
                            itineraryWarnings.push("This itinerary includes transfers with times above your maximum preference.");
                            leg.warning = "This transfer wait time is approximately " + humanizeDuration(timeDiff,  { units: [units], round: true });
                            break;
                        }
                        leg.transferTimeInMins = Math.round(transferTimeInMins);
                    }

                    if(leg.transitLeg)
                        foundFirstTransitLeg = true;

                }

                for(var i = 0; i < itinerary.json_legs.length; i++){
                    var leg = itinerary.json_legs[i];
                    if(leg.transitLeg){
                        var startTime = moment(leg.startTime);
                        var requestedStartTime = moment(this.tripPlanningPrefsObject.fromTime);
                        var minutesEarly = requestedStartTime.diff(startTime, 'minutes');
                        if(minutesEarly > this.tripPlanningPrefsObject.allowDeparturesTime && this.tripPlanningPrefsObject.fromTimeType == 'depart'){
                            itineraryWarnings.push("This itinerary has a departure earlier than the limit you specified.");
                            leg.warning = "This itinerary has a departure earlier than the limit you specified.";
                        }
                        break;
                    }
                }

                if (this.tripPlanningPrefsObject.fromTimeType == 'arrive')
                {
                    i = itinerary.json_legs.length - 1;
                    var leg = itinerary.json_legs[i];
                    var endTime = moment(leg.endTime);
                    var requestedStartTime = moment(this.tripPlanningPrefsObject.fromTime);
                    var requestedStartDate = moment(this.tripPlanningPrefsObject.fromDate);
                    requestedStartTime.set({'year': requestedStartDate.get('year'),  'month': requestedStartDate.get('month'), 'date': requestedStartDate.get('date'),
                    'hour':requestedStartTime.get('hour'), 'minute': requestedStartTime.get('minute'), 'second': requestedStartTime.get('second'), 'millisecond': requestedStartTime.get('millisecond')});
                    var minutesEarly = requestedStartTime.diff(endTime, 'minutes');
                    if(minutesEarly < 0){
                        itineraryWarnings.push("This itinerary has an arrival later than the limit you specified.");
                    }
                }

                var totalWalkMeters = 0;
                var totalWalkTimeInSeconds = 0;

                //if the actual travel time (include the bus waiting time at stop) is 10 minutes and more than the leg.duration, show user the warning message.
                for(var i = 0; i < itinerary.json_legs.length; i++){
                    var leg = itinerary.json_legs[i];
                    var legDuration = (leg.endTime - leg.startTime) /1000;
                    if ((legDuration - leg.duration) >= 600) {
                        if (leg.warning) {
                            leg.warning = leg.warning + "\nTravel time may not look correct due to different arrival/departure time.";
                        } else {
                            leg.warning = "Travel time may not look correct due to different arrival/departure time.";
                        }
                    }
                }

                var totalWalkMeters = 0;
                var totalWalkTimeInSeconds = 0;
                var totalDistance = 0;
                for(var i = 0; i < itinerary.json_legs.length; i++){
                    var leg = itinerary.json_legs[i];
                    if(leg.mode == 'WALK'){

                        if (result.alerts){
                            if(result.alerts.mode_walk != undefined && result.alerts.mode_walk.length > 0) {
                                if(itineraryWarnings.indexOf(result.alerts.mode_walk[0].alertHeaderText) < 0) {
                                    itineraryWarnings.push(result.alerts.mode_walk[0].alertHeaderText);
                                }
                            }
                        }

                        totalWalkMeters += leg.distance;
                        totalWalkTimeInSeconds += leg.duration;
                    }
                    totalDistance += leg.distance;
                }
                itinerary.walk_distance = totalWalkMeters;
                itinerary.walk_time = totalWalkTimeInSeconds;
                itinerary.total_distance = totalDistance;
                var walkMiles = itinerary.walk_distance * metersToMiles;
                if(walkMiles > this.tripPlanningPrefsObject.maxWalkDistance){
                    itineraryWarnings.push("This itinerary exceeds your maximum walking distance.");
                }

                var totalBikeMeters = 0;
                var totalBikeTimeInSeconds = 0;
                for(var i = 0; i < itinerary.json_legs.length; i++){
                    var leg = itinerary.json_legs[i];
                    if(leg.mode == 'BICYCLE'){

                        if (result.alerts){
                            if(result.alerts.mode_bicycle != undefined && result.alerts.mode_bicycle.length > 0) {
                                if(itineraryWarnings.indexOf(result.alerts.mode_bicycle[0].alertHeaderText) < 0){
                                    itineraryWarnings.push(result.alerts.mode_bicycle[0].alertHeaderText);
                                }
                            }
                        }

                        totalBikeMeters += leg.distance;
                        totalBikeTimeInSeconds += leg.duration;
                    }
                }
                itinerary.bike_distance = totalBikeMeters;
                itinerary.bike_time = totalBikeTimeInSeconds;

                var bikeMiles = itinerary.bike_distance * metersToMiles;
                if(bikeMiles > this.tripPlanningPrefsObject.maxBikeDistance){
                    itineraryWarnings.push("This itinerary exceeds your maximum bicycling distance.");
                }

//                for(var i = 0; i < itinerary.json_legs.length; i++)
//                {
//                    var leg = itinerary.json_legs[i];
//                    if(leg.alerts != null){
//                        for(var j = 0;  j < leg.alerts.length; j++){
//                            var legAlert = leg.alerts[j]
//
//                            var alertMessage = legAlert.alertHeaderText
//                            if(legAlert.alertDescriptionText){
//                                alertMessage += '</h4> <p class="leg--warning">' + legAlert.alertDescriptionText + '</p> <h4 class="leg--warning">';
//                            }
//
//                            itineraryWarnings.push(alertMessage)
//
//                        }
//                    }
//                }

                if(itineraryWarnings.length > 0){
                    var searchPrefsWarnings = '';
                    for(var i = 0; i < itineraryWarnings.length; i++)
                    {

                        searchPrefsWarnings += '<h4 class="leg--warning">'+itineraryWarnings[i]+'</h4>'
                    }
                    itinerary.searchPrefsWarnings =  searchPrefsWarnings;
                }

            }
          }

      this.setItineraryLegDescriptions = function(leg){
        leg.startDateDesc = this.getDateDescription(leg.startTime);
        leg.startTimeDesc = moment(leg.startTime).format('h:mm a')
        leg.startDesc = leg.startDateDesc + " at " + leg.startTimeDesc;
        leg.endDateDesc = this.getDateDescription(leg.endTime);
        leg.endTimeDesc = moment(leg.endTime).format('h:mm a');
        leg.endDesc = leg.endDateDesc + " at " + leg.endTimeDesc;
        if(leg.duration < 60){
          leg.travelTime = "Less than a minute"
        }else{
          leg.travelTime = humanizeDuration(leg.duration * 1000,  { units: ["hours", "minutes"], round: true });
        }
        leg.distanceDesc = ( leg.distance * 0.000621371 ).toFixed(2);
        leg.dayAndDateDesc = moment(leg.startTime).format('dddd, MMMM Do');
        var stopId = leg.from.stopId;
        if(stopId)
          leg.stopId = stopId.substr(stopId.indexOf(":") + 1);
        if(leg.intermediateStops){
          for(var i = 0; i < leg.intermediateStops.length; i++){
            if(leg.intermediateStops[i].stopId){
              leg.intermediateStops[i].stopId =  leg.intermediateStops[i].stopId.substr(stopId.indexOf(":") + 1);
            }else{
              leg.intermediateStops[i].stopId =  "None";
            }

          }
        }
        var endStopId = leg.to.stopId;
        if(endStopId)
          leg.endStopId = endStopId.substr(endStopId.indexOf(":") + 1);
      }

          this.setWalkingDescriptions = function(step){
            step.distanceDesc = ( step.distance * 0.000621371 ).toFixed(2);
            step.arrow = 'up';

            if(step.relativeDirection.indexOf('RIGHT') > -1){
              step.arrow = 'right';
            }else if(step.relativeDirection.indexOf('LEFT') > -1){
              step.arrow = 'left';
            }

            if(step.relativeDirection == 'DEPART'){
              step.description = 'Head ' + step.absoluteDirection.toLowerCase() + ' on ' + step.streetName;
            }else{
              step.description = this.capitalizeFirstLetter(step.relativeDirection) + ' on ' + step.streetName;
            }
            step.description = step.description.replace(/_/g,' ');
          }

          this.capitalizeFirstLetter = function(string) {
            return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
          }

          this.getAddressDescriptionFromLocation = function(location){
            var description = {};
            if(location.poi){
              description.line1 = location.poi.name
              description.line2 = location.formatted_address;
              if(description.line2 && description.line2.indexOf(description.line1) > -1){
                description.line2 = description.line2.substr(description.line1.length + 2);
              }
            }else if(location.name){
              description.line1 = location.name;
              description.line2 = location.formatted_address;
              if(description.line2 && description.line2.indexOf(description.line1) > -1){
                description.line2 = description.line2.substr(description.line1.length + 2);
              }
            }else{
                if(location.address_components){
                    angular.forEach(location.address_components, function(address_component, index) {
                        if(address_component.types.indexOf("street_address") > -1){
                            description.line1 = address_component.long_name;
                        }
                    }, description.line1);
                }
              description.line2 = location.formatted_address;
              if(description.line2 && description.line2.indexOf(description.line1) > -1){
                description.line2 = description.line2.substr(description.line1.length + 2);
              }
            }
            return description;
          }

          this.getDateDescription = function(date){
            if(!date)
              return null;
            var description;
            var now = moment().startOf('day');
            var then = moment(date).startOf('day');
            var dayDiff = now.diff(then, 'days');
            if(dayDiff == 0) {
              description = "Today";
            }else if (dayDiff == -1) {
              description = "Tomorrow";
            }else if (dayDiff == 1) {
              description = "Yesterday";
            }else{
              description = moment(date).format('dddd MMM DD, YYYY');
            }
            return description;
          }

          this.selectItineraries = function($http, itineraryObject) {
            return $http.post('api/v1/itineraries/select', itineraryObject, this.getHeaders());
          }

          this.checkServiceArea = function($http, place) {
            return $http.post('api/v1/places/within_area', place, this.getHeaders());
          }

          this.postItineraryRequest = function($http) {
            return $http.post('api/v1/itineraries/plan', this.itineraryRequestObject, this.getHeaders());
          }

          this.createItineraryRequest = function(waypoints, waypointIndex, reverseOrder, $scope) {
            for(var i = 0; i < waypoints.length; i++){
              var waypoint = waypoints[i];
              if(waypoint.locationDetails.poi){
                waypoint.locationDetails.name = waypoint.locationDetails.poi.name
              }
            }
            var request = {};
            request.source_tag = 'internal';
            request.trip_purpose = 'general_purpose';
            request.optimize = this.prefer;
            request.itinerary_request = [];
            var outboundTrip = {};
            outboundTrip.segment_index = 0;
            var fromIndex, toIndex;
            if(reverseOrder){
                var toIndex = waypointIndex;
                var fromIndex = waypointIndex - 1;
            }else{
                fromIndex = waypointIndex != null ? waypointIndex : 0;
                toIndex = waypointIndex != null  ? waypointIndex + 1 : waypoints.length - 1;
            }

            outboundTrip.start_location = waypoints[fromIndex].locationDetails;
            outboundTrip.end_location = waypoints[toIndex].locationDetails;
            this.addStreetAddressToLocation(outboundTrip.start_location);
            this.addStreetAddressToLocation(outboundTrip.end_location);
            
            var fromTime = this.fromTime;
            if(fromTime == null){
              fromTime = new Date();
            }else{
              fromTime = moment(this.fromTime).toDate();
            }
            var hourBefore = fromTime.getHours();
            if (this.fromTimeType == 'asap' && (waypointIndex == null || waypointIndex < 1)){
                fromTime = new Date();
            }else if (this.fromTimeType == 'depart' && (waypointIndex == null || waypointIndex < 1)) {
              fromTime.setMinutes(fromTime.getMinutes() - this.allowDeparturesTime);
            }
            var hourAfter = fromTime.getHours();
            
            var fromDate = moment(this.fromDate).startOf('day').toDate();
            if ((hourAfter - hourBefore) === 23) {
                fromDate.setDate(fromDate.getDate() -1);
            }
            fromDate.setHours(fromTime.getHours());
            fromDate.setMinutes(fromTime.getMinutes());
            outboundTrip.trip_time = moment.utc(fromDate).format();
            outboundTrip.departure_type = this.fromTimeType;
            if (this.fromTimeType == 'asap'){
                outboundTrip.departure_type = 'depart';
            }
            request.itinerary_request.push(outboundTrip);
            request.num_itineraries = $scope.routesToShow ? $scope.routesToShow : 3;
            return request;
          };

          this.addStreetAddressToLocation = function(location) {
              if(!location.address_components)
                  return;
            var street_address;
            angular.forEach(location.address_components, function(address_component, index) {
              if(address_component.types.indexOf("street_number") > -1){
                street_address = address_component.long_name + " ";
              }
            }, street_address);

            angular.forEach(location.address_components, function(address_component, index) {
              if(address_component.types.indexOf("route") > -1){
                street_address += address_component.long_name;
              }
            }, street_address);

            location.address_components.push(
                {
                  "long_name": street_address,
                  "short_name": street_address,
                  "types": [
                    "street_address"
                  ]
                }
            )
          }

          this.getHeaders = function(){
            var headers = {headers:  {
              "X-User-Email" : this.email,
              "X-User-Token" : this.authentication_token}
            };
            return headers;
          }

          this.createFeatureCollection = function(data) {
            //rtd service area polygon
            var boundaryPoints = [[[-122.15766869531251,31.293047956910797],[-122.15766869531251,48.188449068509655],[-87.82539330468751,48.188449068509655],[-87.82539330468751,31.293047956910797],[-122.15766869531251,31.293047956910797]]];

            var featureCollection = {
                "type": "FeatureCollection",
                "features":[
                    {
                        "type": "Feature",
                        "properties": {
                            "name": "Mask"
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": boundaryPoints
                        },
                        "style":{
                            //all SVG styles allowed
                            "fill":"red",
                            "stroke-width":"3",
                            "fill-opacity":0.6
                        }
                    }
                ]
            };

            for(var i = 0; i < data.coordinates.length; i++){
                var subCoordinates = data.coordinates[i];
                for(var j = 0; j < subCoordinates.length; j++){
                    var pointsForPolygon = subCoordinates[j];
                    featureCollection.features[0].geometry.coordinates.push(pointsForPolygon);
                }
            }
            return featureCollection;
          }

        this.renderMap = function($http, itinerary_ids) {
          return $http.post('/api/v1/itineraries/request_create_maps', itinerary_ids, this.getHeaders());
        }

        this.checkMapStatus = function($http, itinerary_ids) {
          return $http.post('/api/v1/itineraries/map_status', itinerary_ids, this.getHeaders());
        }
        }
    );


angular.module('applyMyRideApp')
    .service('LocationSearch', function($http, $q, localStorageService){

      var autocompleteService = new google.maps.places.AutocompleteService();

      var geocoder = new google.maps.Geocoder();

      var LocationSearch = new Object();

      LocationSearch.getLocations = function(text, config, blacklist) {

        var compositePromise = $q.defer();

        $q.all([LocationSearch.getGooglePlaces(text, blacklist), LocationSearch.getIntersectionGooglePlaces(text), LocationSearch.getSavedPlaces(text, config)]).then(function(results){
          compositePromise.resolve(results);
        });

        return compositePromise.promise;

      }

      LocationSearch.getGooglePlaces = function(text, blacklist) {
        var googlePlaceData = $q.defer();
        this.placeIds = [];
        this.results = [];
        var that = this;

        autocompleteService.getPlacePredictions(
            {
              input: text,
              bounds: new google.maps.LatLngBounds(
                  //RTD service area
                  new google.maps.LatLng(39.07890809706475,-105.72967529296875),
                  new google.maps.LatLng(40.29628651711716,-104.48272705078125)
              ),
            }, function(list, status) {
              angular.forEach(list, function(value, index) {

                //verify the location has a street address
                if(that.results.length < 10 && ((value.types.indexOf('route') > -1) || (value.types.indexOf('establishment') > -1) || (value.types.indexOf('street_address') > -1) || (value.types.indexOf('premise') > -1))){
                  var terms = [];
                  angular.forEach(value.terms, function(term, index) {
                    terms.push(term.value)
                  }, terms);
                    if(value.description.indexOf("CO,")  > -1 || value.description.indexOf(" CO ")  > -1){
                        if(!blacklist || blacklist.indexOf(value.place_id) == -1){
                            that.results.push(terms.join(" "));
                            that.placeIds.push(value.place_id);
                        }else{
                            console.log("blacklisted location: " + value.place_id);
                        }
                    }else{
                        console.log("Not in colorado: " + value.description);
                    }
                }
              });
              googlePlaceData.resolve({googleplaces:that.results, placeIds: that.placeIds});
            });
        return googlePlaceData.promise
      }

      /**
       * Determine if the input Google Maps geocoder intersection address has a cross street.
       * This is defined as having at least 3 characters after the separator.
       */
      LocationSearch.intersectionAddressHasCrossStreet = function(address) {
        var replacedSeparators = address.replace(/ (&|at) /g, '&');
        var firstSeparatorIndex = replacedSeparators.search('&');
        var crossStreet = replacedSeparators.slice(firstSeparatorIndex + 1);
        return (crossStreet.length > 2);
      }

      LocationSearch.getIntersectionGooglePlaces = function(text) {
        var googlePlaceData = $q.defer();
        this.intersectionPlaceIds = [];
        this.intersectionResults = [];
        var that = this;

        var bounds = new google.maps.LatLngBounds(
            //RTD service area
            new google.maps.LatLng(39.07890809706475,-105.72967529296875),
            new google.maps.LatLng(40.29628651711716,-104.48272705078125)
        );

        // We are allowing forward slash, back slash, @-symbol and 'and' as application-specific intersection separators.
        // Replace them in search address with ampersand, a Google Maps intersection separator.
        // Even though the geocoder accepts 'and' as a separator, doesn't consistently return intersections.
        var address = text.replace(/ (\/|\\|@|and|-) /g, ' & ');

        if ((address.indexOf(' & ') > -1 || address.indexOf(' at ') > -1) &&
            LocationSearch.intersectionAddressHasCrossStreet(address)) {

          // Search text contains a Google Maps intersection separator, so it may be an intersection.
          // Also contains enough of a cross street name to return relevant matches.
          geocoder.geocode(
              {
                address: address,
                bounds: bounds

              }, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                  angular.forEach(results, function(value, index) {
                    if (value.types.length > 0 && value.hasOwnProperty('formatted_address') && ((value.types[0].indexOf('intersection') > -1) || value.formatted_address.indexOf(' & ') > -1) ) {
                      if(value.formatted_address && value.formatted_address.indexOf("CO")  > -1){
                        that.intersectionResults.push(value.formatted_address);
                        that.intersectionPlaceIds.push(value.place_id);
                      }else if(value.description && value.description.indexOf("CO")  > -1){
                        that.intersectionResults.push(value.formatted_address);
                        that.intersectionPlaceIds.push(value.place_id);
                      }else{
                        console.log("Not in colorado: " + value.formatted_address);
                      }
                    }
                  });
                }
                googlePlaceData.resolve({googleplaces:that.intersectionResults, placeIds: that.intersectionPlaceIds});
              });
        } else {
          // Do I need this empty resolve?
          googlePlaceData.resolve({googleplaces:that.intersectionResults, placeIds: that.intersectionPlaceIds});
        }

        return googlePlaceData.promise
      }

      LocationSearch.getSavedPlaces = function(text, config) {
        var savedPlaceData = $q.defer();
        this.savedPlaceIds = [];
        this.savedPlaceAddresses = [];
        this.savedPlaceResults = [];
        this.poiData = [];
        var that = this;
        var encodedText = encodeURIComponent(text);
        $http.get('/api/v1/places/search?include_user_pois=true&search_string=%25' + encodedText + '%25', config).
        success(function(data) {
          var locations = data.places_search_results.locations;
          angular.forEach(locations, function(value, index) {
            if(that.savedPlaceResults.length < 10){
              if(value.stop_code){
                var optionText = "Stop # " + value.stop_code + " - " + value.name;
                if(value.formatted_address)
                  optionText = optionText + ", " + value.formatted_address;
                that.savedPlaceResults.push(optionText);
                that.savedPlaceAddresses.push(value.formatted_address);
                that.savedPlaceIds.push(optionText);
                that.poiData.push(value);
              }else{
                that.savedPlaceResults.push(value.name + " " + value.formatted_address);
                that.savedPlaceAddresses.push(value.formatted_address);
                that.savedPlaceIds.push(value.place_id);
                that.poiData.push(value);
              }
            }
          });
          savedPlaceData.resolve({savedplaces:that.savedPlaceResults, placeIds: that.savedPlaceIds, savedplaceaddresses: that.savedPlaceAddresses, poiData: that.poiData});
        });
        return savedPlaceData.promise;
      }

      return LocationSearch;
    });