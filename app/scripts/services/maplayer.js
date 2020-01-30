'use strict';


angular.module('applyMyRideApp')
    .service('mapLayerService', ['$http', function($http) {

        // API Urls.
        this.parkNRideApiUrl = '/api/v1/defaults/pass?path=parkAndRides';

        this.routesApiUrl = '/api/v1/defaults/pass?path=index/routes';
        this.routePatternsApiUrl = '/api/v1/defaults/pass?path=index/routes/{routeId}/patterns';

     	this.patternsApiUrl = '/api/v1/defaults/pass?path=index/patterns';

        this.stationsApiUrl = '/api/v1/defaults/pass?path=index/stops?locationType=1';

        this.stopsApiUrl = '/api/v1/defaults/pass?path=index/stops?locationType=0';

    	// Layers Configuration.
    	this.layersConfig = {
    		"parknride" : {
    			apiUrl: this.parkNRideApiUrl,
    			id: "parknride",
    			minZoomLevel: 12
    		},

    		"routes" : {
    			apiUrl: this.routesApiUrl,
    			id: "routes",
    			minZoomLevel: 5
    		},

    		"stations" : {
    			apiUrl: this.stationsApiUrl,
    			id: "stations",
    			minZoomLevel: 12
    		},

    		"stops" : {
    			apiUrl: this.stopsApiUrl,
    			id: "stops",
    			minZoomLevel: 16
    		}
    	};

    	this.infowindow = new google.maps.InfoWindow();
        
        this.httpGet = function (theUrl)
        {
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
            xmlHttp.send( null );
            return xmlHttp.responseText;
        }

        this.getStopRoutes = function (stopId) {
            var stopRoutesUrl = '/api/v1/defaults/pass?path=index/stops/' + stopId + "/routes";
            var d = this.httpGet(stopRoutesUrl);
            var result = JSON.parse(d).message;
            var res = [];
            for (var i = 0; i < result.length; i++) {
                var routeData = result[i];
                res[i] = routeData;
            }
            return res;
        }

        this.getStopRouteTimes = function (stopId) {
            var stopRouteTimesUrl = '/api/v1/defaults/pass?path=index/stops/' + stopId + "/stoptimes/";
            var dt = new Date();
            var month = dt.getMonth()+1;
            var day = dt.getDate();
            var year = dt.getFullYear();
            if (day < 10) {
              day = '0' + day;
            } 
            if (month < 10) {
              month = '0' + month;
            } 
            stopRouteTimesUrl = stopRouteTimesUrl + year + month + day;
            var d = this.httpGet(stopRouteTimesUrl);
            var result = JSON.parse(d).message;
            var res = [];
            for (var i = 0; i < result.length; i++) {
                var routeData = result[i];
                res[i] = routeData;

            }
            return res;
        }

        this.getCurrentTime = function () {
            var today = new Date();
            var d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0); 
            var res = today.getTime() - d.getTime();
            return res;
        }

        this.getRouteNextThreeDepartureTimes = function (routeTimes, routeId, curTime) {
            var res = [];
            var dt;
            var hh;
            var mm;
            var ap;
            var map = new Map;

            for (var i = 0; i < routeTimes.length; i++) {
                if (routeTimes[i].route.shortName === routeId) {
                    for (var j = 0; j < routeTimes[i].times.length; j++) {
                        if (routeTimes[i].times[j].scheduledDeparture * 1000 > curTime) {
                            res.push(routeTimes[i].times[j].scheduledDeparture * 1000);
                            map.set(routeTimes[i].times[j].scheduledDeparture * 1000, routeTimes[i].times[j].tripHeadsign);
                        }

                    }
                }
            }
            res.sort();
            var result = "";
            var headsign;
            if (res.length > 0) {
                var size = res.length;
                if (size > 3) {size = 3;}
                for (var i = 0; i < size; i++) {
                    headsign = map.get(res[i]);
                    dt = new Date(res[i]);
                    hh = dt.getUTCHours();
                    mm = dt.getUTCMinutes();
                    ap = "A";
                    if (hh < 10) {
                        hh = "0"+hh;
                    } else if (hh > 12){
                        hh = hh-12;
                        ap = "P";
                    } else if (hh === 12) {
                        ap = "P";
                    }
                    if (mm < 10) {mm = "0"+mm;}
//                            if (result === "") {
//                                result = hh + ":" + mm + ap + " (" + headsign + ")";
//                            } else {
//                                result = result + ", " + hh + ":" + mm + ap + " (" + headsign + ")";
//                            }
                    result = result + "<div  style='width:280px; height:20px; text-align: left;'>" + hh + ":" + mm + ap + " (" + headsign + ")</div>";

                }
            } else {
                //result = "N/A";
                result = "<div  style='width:280px; height:20px; text-align: left;'>N/A</div>";
            }
            return result;
        }
                
        this.addAllLayersToMap = function(map, mapLayersById) {

            this.addParkNRideMapLayer(map, mapLayersById);
            // Disable GTFS-based Routes layer. May replace with Shapefile-based Routes layer.
            //this.addRoutesMapLayer(map, mapLayersById);
            this.addStationsMapLayer(map, mapLayersById);
            this.addStopsMapLayer(map, mapLayersById);
        }

    	this.addRoutesMapLayer = function(map, mapLayersById) {
  
    		var layerApiUrl = this.layersConfig["routes"].apiUrl;
    		var layerId = this.layersConfig["routes"].id;
     		var layerMinZoomLevel = this.layersConfig["routes"].minZoomLevel;

    		var thisScope = this;
            $http.get(layerApiUrl)
			  .then(function onSuccess(response) {

			    var data = response.data.message;
			    var featureCollection = thisScope.createRouteFeatureCollection(data);
                var dataLayer = new google.maps.Data();
                dataLayer.addGeoJson(featureCollection);
                mapLayersById[layerId] = dataLayer;

                thisScope.updateRouteFeaturesWithPatterns(thisScope, dataLayer);

				dataLayer.setStyle(function(feature) {
    				var color = "#" + feature.getProperty('color');
				    return {
				      strokeColor: color
				    };
				});

				// When the user clicks, open an infowindow.
				dataLayer.addListener('click', function(event) {
				    var myHTML = event.feature.getProperty("longName");

				    thisScope.infowindow.setContent("<div style='width:150px; text-align: center;'>" + myHTML + "</div>");
				    thisScope.infowindow.setPosition(event.latLng);
				    thisScope.infowindow.setOptions({pixelOffset: new google.maps.Size(0,-30)});
				    thisScope.infowindow.open(map);
				  });  

				// Set the initial checkbox state.
			    var zoomLevel = map.getZoom();
			    var layerCheckbox = document.querySelector("#" + layerId);
			    layerCheckbox.disabled = (zoomLevel < layerMinZoomLevel);

				map.addListener('zoom_changed', function(event) {
				    var zoomLevel = map.getZoom();
				    var layerCheckbox = document.querySelector("#" + layerId);
				    if (zoomLevel >= layerMinZoomLevel) {
				    	// If this zoom level is allowed and the layer is checked, enable the layer checkbox and show the map layer.
				    	layerCheckbox.disabled = false;
				    	if (layerCheckbox && layerCheckbox.checked) { thisScope.showMapLayer(map, dataLayer); }
				    } else {
				    	// If this zoom level is not allowed, disable the layer checkbox and hide the map layer.
				    	layerCheckbox.disabled = true;
				        thisScope.hideMapLayer(dataLayer);
				    }
				});
			  }).catch(function onError(response) {

			  	console.log("Error adding map layer.");
			  });          
        }

    	this.addParkNRideMapLayer = function(map, mapLayersById) {

    		var layerApiUrl = this.layersConfig["parknride"].apiUrl;
    		var layerId = this.layersConfig["parknride"].id;
     		var layerMinZoomLevel = this.layersConfig["parknride"].minZoomLevel;
     		// Icon SVG image is from RTD style .i--legend-pnr-red
     		var layerStyle = {
    			icon: {
    				url: 'data:image/svg+xml;charset=US-ASCII,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cg%20id%3D%22legend-pnr-red%22%3E%3Cpath%20id%3D%22pnr-bdr%22%20fill%3D%22%23fff%22%20d%3D%22M20%2C15.738C20%2C18.092%2C18.092%2C20%2C15.738%2C20H4.262C1.908%2C20%2C0%2C18.092%2C0%2C15.738V4.262%20%20C0%2C1.908%2C1.908%2C0%2C4.262%2C0h11.477C18.092%2C0%2C20%2C1.908%2C20%2C4.262V15.738z%22%2F%3E%3Cpath%20id%3D%22pnr-fill%22%20fill%3D%22%23cf0a2c%22%20d%3D%22m13.952%2010.707h-1.415v-5.635c0-1.41%201.415-1.41%201.415-1.41h5.259v7.04h-5.259zm-.62%202.985c.484%200%20.873-.391.873-.873%200-.482-.389-.869-.873-.869-.481%200-.872.387-.872.869%200%20.482.391.873.872.873m1.828%200c.481%200%20.872-.391.872-.873%200-.482-.391-.869-.872-.869-.482%200-.871.387-.871.869%200%20.482.389.873.871.873zm-1.208%204.059h-1.415v-1.41c0%200-1.402%200-1.402-1.41s0-11.269%200-11.269%200-1.41%201.402-1.41c1.415%200%205.926%200%205.926%200-1.41-1.41-2.071-1.41-3.479-1.41h-4.934v18.313h4.934c.609%200%203.137.13%204.138-2.815h-5.17v1.411m-7.218-5.636l-.88-2.82h-4.98v2.819h5.86m-.442%202.895c.481%200%20.87-.387.87-.869%200-.481-.389-.873-.87-.873-.479%200-.868.391-.868.873%200%20.482.388.869.868.869m-2.112%200c.481%200%20.875-.387.875-.869%200-.481-.394-.873-.875-.873-.48%200-.873.391-.873.873%200%20.482.392.869.873.869zm5.402-14.165h-5.177c-1.802%200-3.606%201.567-3.606%203.609l-.036%203.435h6.125l1.407%204.229v5.635h-2.815v-1.41h-4.594c.582%202.25%202.358%202.815%204.104%202.815h4.592v-18.313%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E'
    			}
          	};
    		this.addPointMapLayer(map, mapLayersById, layerApiUrl, layerId, layerMinZoomLevel, layerStyle);              
        }

    	this.addStopsMapLayer = function(map, mapLayersById) {

    		var layerApiUrl = this.layersConfig["stops"].apiUrl;
    		var layerId = this.layersConfig["stops"].id;
     		var layerMinZoomLevel = this.layersConfig["stops"].minZoomLevel;
     		// Icon SVG image is from RTD style .i--legend-bus-stop-blue
     		var layerStyle = {
    			icon: {
    				url: 'data:image/svg+xml;charset=US-ASCII,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cg%20id%3D%22legend-bus-stop-blue%22%3E%3Cpath%20id%3D%22bus-stop-bdr%22%20fill%3D%22%23fff%22%20d%3D%22M15.913%2C0H4.347C1.983%2C0-0.041%2C1.583-0.041%2C3.947v11.596%20%20c0%2C2.363%2C2.024%2C4.458%2C4.388%2C4.458h11.595c2.363%2C0%2C4.018-2.095%2C4.018-4.458V3.947C19.959%2C1.583%2C18.276%2C0%2C15.913%2C0z%22%2F%3E%3Cpath%20id%3D%22bus-stop-fill%22%20fill%3D%22%230e75bb%22%20d%3D%22m14.185%2012.453c0%20.354-.287.639-.641.639-.354%200-.641-.285-.641-.639s.286-.639.641-.639c.353%200%20.641.285.641.639m-2.154-.639c-.354%200-.639.285-.639.639s.285.639.639.639.64-.285.64-.639-.286-.639-.64-.639m-4.191%200c-.353%200-.639.285-.639.639s.286.639.639.639c.354%200%20.641-.285.641-.639s-.287-.639-.641-.639m-1.513%200c-.353%200-.639.285-.639.639s.286.639.639.639c.354%200%20.641-.285.641-.639s-.286-.639-.641-.639m12.714-7.867v11.596c0%201.796-1.429%203.458-3.226%203.458h-11.594c-1.796%200-3.18-1.662-3.18-3.458v-11.596c0-1.796%201.384-2.947%203.18-2.947h11.634c1.795%200%203.186%201.151%203.186%202.947m-3.353.305c0%200%200-1.261-1.261-1.261h-.839-1.335-6.598c-1.262%200-1.262%201.261-1.262%201.261v10.09c0%201.261%201.262%201.261%201.262%201.261v1.403h1.836v-1.403h1.754.729%202.615v1.403h1.838v-1.403c0%200%201.261%200%201.261-1.261v-10.09m-2.956%200h-5.815c0%200-1.262%200-1.262%201.261v5.04h1.262%207.335v-4.974c0-1.524-1.52-1.332-1.52-1.332%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E'
    			}     		
    		};
    		this.addPointMapLayer(map, mapLayersById, layerApiUrl, layerId, layerMinZoomLevel, layerStyle);              
        }

    	this.addStationsMapLayer = function(map, mapLayersById) {

    		var layerApiUrl = this.layersConfig["stations"].apiUrl;
    		var layerId = this.layersConfig["stations"].id;
     		var layerMinZoomLevel = this.layersConfig["stations"].minZoomLevel;
     		// Icon SVG image is from RTD style .i--legend-lr-station-red
    		var layerStyle = {
    			icon: {
    				url: 'data:image/svg+xml;charset=US-ASCII,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cg%20id%3D%22legend-lr-station-red%22%3E%3Cpath%20id%3D%22lr-station-bdr%22%20fill%3D%22%23fff%22%20d%3D%22m15.857%200h-11.566c-2.363%200-4.332%201.649-4.332%204.01v11.596c0%202.363%201.969%204.392%204.332%204.392h11.596c2.362%200%204.072-2.029%204.072-4.392v-11.596c0-2.363-1.738-4.01-4.102-4.01%22%2F%3E%3Cpath%20id%3D%22lr-station-fill%22%20fill%3D%22%23cf0a2c%22%20d%3D%22m6.803%205.828h6.278c.166%200%20.303.137.303.304v4.752c0%20.167-.137.302-.303.302h-6.278c-.168%200-.302-.134-.302-.302v-4.752c0-.167.134-.304.302-.304m1.461%205.935h-1.223c-.083%200-.151.067-.151.152v.545c0%20.084.068.151.151.151h1.223c.084%200%20.152-.066.152-.151v-.545c0-.084-.068-.152-.152-.152m4.579%200h-1.225c-.083%200-.151.067-.151.152v.545c0%20.084.068.151.151.151h1.225c.083%200%20.151-.066.151-.151v-.545c0-.084-.068-.152-.151-.152m-1.751-10.763h-2.295l1.149%201.146%201.146-1.146m4.666%200h-3.705l-1.771%201.776v.544h4.375c.541%200%20.95.373.95.781v7.962l-1.46%201.46h-8.376l-1.491-1.486v-7.935c0-.408.406-.781.948-.781h4.375v-.547l-1.772-1.774h-3.707c-1.796%200-3.124%201.216-3.124%203.01v11.596c0%201.796%201.328%203.392%203.124%203.392h2.446l-.231-.144%201.87-3.03h-.235l-1.932%201.93h-1.019c-.541%200-.744-.337-.744-.677v-4.063l1.287%201.285h8.817l1.223-1.224v4c0%20.34-.205.677-.749.677h-1.025l-1.933-1.93h-.29l1.999%203.02-.22.147h2.332c1.795%200%203.28-1.596%203.28-3.392v-11.596c0-1.796-1.446-3.01-3.242-3.01m-8.97%203.675v.445c0%20.166.135.302.303.302h5.6c.167%200%20.304-.136.304-.302v-.445c0-.17-.137-.304-.304-.304h-5.6c-.168%200-.303.133-.303.304m1.818%2011.155l-1.958%203.17h6.652l-2.099-3.17h-2.595%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E'
    			}
			};
    		this.addPointMapLayer(map, mapLayersById, layerApiUrl, layerId, layerMinZoomLevel, layerStyle);             
        }

        // Load the specified Point map layer and convert it to GeoJson format.
    	this.addPointMapLayer = function(map, mapLayersById, layerApiUrl, layerId, layerMinZoomLevel, layerStyle) {

    		var thisScope = this;
            $http.get(layerApiUrl)
			  .then(function onSuccess(response) {

			    var data = response.data.message;
			    var featureCollection = thisScope.createPointFeatureCollection(data);
                var dataLayer = new google.maps.Data();
                dataLayer.addGeoJson(featureCollection);
                mapLayersById[layerId] = dataLayer;

                if (layerStyle) {
					dataLayer.setStyle(layerStyle);   
				}

				// When the user clicks, open an infowindow.
				dataLayer.addListener('click', function(event) {
				    var myStopId = event.feature.getProperty("code");
                                    var myHTML = event.feature.getProperty("name");
                                    var myDesc = event.feature.getProperty("desc");
                                    var wheelchair = event.feature.getProperty("wheelchair");
                                    var routes = thisScope.getStopRoutes(event.feature.m);
                                    var routesTimes = thisScope.getStopRouteTimes(event.feature.m);
                                    var routesTimesStr = "";
                                    var contentStr = "";
                                    var curTime = thisScope.getCurrentTime();
//                                    console.log(routesTimes);
                                    
                                    contentStr = contentStr + "<div style='width:280px; height:20px; text-align: left;'><b>Stop: </b>" + myHTML + "   ";
                                    if (wheelchair === 1) {
                                        contentStr = contentStr + "<img src='images/modes/wheelchair.png' height='15' width='15' hspace='10'/>";
                                    }
                                    contentStr = contentStr + "</div>";
                                    contentStr = contentStr + "<div style='width:280px; height:20px; text-align: left;'><b>Stop id: </b>" + myStopId + "</div>";
                                    contentStr = contentStr + "<div style='width:280px; height:20px; text-align: left;'><b>Direction: </b>" + myDesc + "</div>";
                                    
                                    contentStr = contentStr + "<div style='width:280px; height:20px; text-align: left;'><img src='images/modes/transit.png' height='20' width='18'/>";
                                    for (var i = 0; i < routes.length; i++) {
                                        contentStr = contentStr + " " + "<span style='padding: 1px 4px 1px; border-radius: 4px; background-color:#" + routes[i].color + "; color: rgb(255, 255, 255)'>" + routes[i].shortName + "</span>";
                                        routesTimesStr = routesTimesStr + "<div style='width:280px; height:20px; text-align: left;'>" + "<b>Route " + "<span style='padding: 1px 4px 1px; border-radius: 4px; background-color:#" + routes[i].color + "; color: rgb(255, 255, 255)'>" + routes[i].shortName + "</span>" + " next 3 departure times:</b></div>";
                                        routesTimesStr = routesTimesStr + thisScope.getRouteNextThreeDepartureTimes(routesTimes, routes[i].shortName, curTime);
                                    }
                                    contentStr = contentStr + "</div>";
                                    contentStr = contentStr + "<hr/>";
                                    contentStr = contentStr + routesTimesStr;
                                    contentStr = contentStr + "<div style='width:250px; height:20px; text-align: left;'></div>";
                                    contentStr = contentStr + "<div class='btn btn-secondary' onclick=''";
                                    
                                    thisScope.infowindow.setContent("<div style='width:300px; height: 200px !important; text-align: left;'>" + contentStr + "</div>");
                                    thisScope.infowindow.setPosition(event.latLng);
                                    thisScope.infowindow.setOptions({pixelOffset: new google.maps.Size(0, -30)});

                                    thisScope.infowindow.open(map);
				  });  

				// Set the initial checkbox state.
			    var zoomLevel = map.getZoom();
			    var layerCheckbox = document.querySelector("#" + layerId);
			    layerCheckbox.disabled = (zoomLevel < layerMinZoomLevel);

				map.addListener('zoom_changed', function(event) {
				    var zoomLevel = map.getZoom();
				    var layerCheckbox = document.querySelector("#" + layerId);
				    if (zoomLevel >= layerMinZoomLevel) {
				    	// If this zoom level is allowed and the layer is checked, enable the layer checkbox and show the map layer.
				    	layerCheckbox.disabled = false;
				    	if (layerCheckbox && layerCheckbox.checked) { thisScope.showMapLayer(map, dataLayer); }
				    } else {
				    	// If this zoom level is not allowed, disable the layer checkbox and hide the map layer.
				    	layerCheckbox.disabled = true;
				        thisScope.hideMapLayer(dataLayer);
				    }
				});
			  }).catch(function onError(response) {

			  	console.log("Error adding map layer.");
			  });            
        }

        // Show the specified map layer on the map if checked is true, hide it if it is false.
		this.toggleMapLayer = function(map, mapLayersById, layerId, checked) {
			var dataLayer = mapLayersById[layerId];
			if (checked == true) {
				this.showMapLayer(map, dataLayer);
			} else { 
				this.hideMapLayer(dataLayer);
			}	
		}

        this.showMapLayer = function(map, dataLayer) {
            dataLayer.setMap(map); 
        }

        this.hideMapLayer = function(dataLayer) {
            dataLayer.setMap(null);
        }

        // Create a collection of Point features from the specified data.
    	this.createPointFeatureCollection = function(data) {

	        var featureCollection = {
	            "type": "FeatureCollection",
	            "features":[
	            ]
	        };

	        for (var i = 0; i < data.length; i++) {
	            var pointData = data[i];
	            var pointFeature = {
	                    "type": "Feature",
	                    "id": pointData.id,
	                    "properties": {
	                        "code": pointData.code,
	                        "name": pointData.name
	                    },
	                    "geometry": {
	                        "type": "Point",
	                        "coordinates": [pointData.lon, pointData.lat]
	                    },
	                };
	            featureCollection.features.push(pointFeature);
	        }
	        return featureCollection;
	    }

		// Create a collection of LineString features from the specified route data.
    	this.createRouteFeatureCollection = function(data) {

	        var featureCollection = {
	            "type": "FeatureCollection",
	            "features":[
	            ]
	        };

	        for (var i = 0; i < data.length; i++) {
	            var routeData = data[i];
	            var polylineFeature = {
	                    "type": "Feature",
	                    "id": routeData.id,
	                    "properties": {
	                    	"agencyName": routeData.agencyName,
	                    	"color": routeData.color,
	                        "longName": routeData.longName,
	                        "mode": routeData.mode,
	                        "shortName": routeData.shortName
	                    },
	                    "geometry": {
	                        "type": "LineString",
	                        "coordinates": []
	                    },
	                    "style":{
                            "strokeColor": "#" + routeData.color
                        }
	                };
	            featureCollection.features.push(polylineFeature);
	        }
	        return featureCollection;
	    }

	    // Update the route features in the data layer with each route's patterns.
	    this.updateRouteFeaturesWithPatterns = function(thisScope, dataLayer) {
	    	dataLayer.forEach(function(feature) {
	    		var routeId = feature.getId();
	    		var apiUrl = thisScope.routesApiUrl + "/" + routeId + "/patterns";
		        $http.get(apiUrl)
				  .then(function onSuccess(response) {

				    var data = response.data.message;
				    for (var i = 0; i < data.length; i++) {
				    	var routePatternData = data[i];
				    	if (i == 0) {
				    		// For now, get the first pattern for the route. Need to decide how to visualize the other patterns.
						    feature.setProperty("patternId", routePatternData.id);
						    feature.setProperty("patternDesc", routePatternData.desc);
						    thisScope.updateRouteFeatureWithPatternGeometry(thisScope, feature);
						    break;
						}
					}
	 
				  }).catch(function onError(response) {

				  	console.log("Error adding route pattern to map layer.");
				  }); 
	    	});

		}

		// Update the route feature with its pattern geometry.
	    this.updateRouteFeatureWithPatternGeometry = function(thisScope, feature) {
    		var patternId = feature.getProperty("patternId");
    		var apiUrl = thisScope.patternsApiUrl + "/" + patternId + "/geometry";
	        $http.get(apiUrl)
			  .then(function onSuccess(response) {

			    var data = response.data.message;
			    if (data && data.points) {
			    	var coordinates = google.maps.geometry.encoding.decodePath(data.points);
                    var geometry = new google.maps.Data.LineString(coordinates);
					feature.setGeometry(geometry);
			    }
 
			  }).catch(function onError(response) {

			  	console.log("Error adding route pattern geometry to map layer.");
			  }); 
	    }

}]);