// Quick array membership thing I found when trying to find an API method - by "Graham B" @
// http://snook.ca/archives/javascript/testing_for_a_v
Array.prototype.has = function(v){
	for (i=0; i<this.length; i++){
		if (this[i]==v) return i;
	}
	return false;
}

// Beware the silent dependency on underscore.js and jquery - and the global vars established in the inline init JS in
// discovu.html

// We send events through a pipeline: they come and go:
// Data source -> Event dispenser (regular output) -> Map manager (display)

// Test model object demonstrating the interface for events-to-be-displayed.
function TestEvent(position, text) {
	this.renderToHtml = function() {
		return text;
	}
	
	this.getPosition = function() {
		return position;
	}
}

// Stage-manages what's displayed on the map - immediate-mode, without any dependency on data fetch intervals or
// what-have-you.
// Currently internally works as a FIFO.
function MapManager(maxItems, mapObject) {
	this.displayFifo = new Array();
	
	// Push a new element of the to-be-displayed FIFO - so that it'll pop up as a GMaps InfoWindow
	// on the map.
	// Pop the last element off if required and remove it from display.
	this.pushEvent = function(newEvent) {
		// First off - are you sure we're not adding in a duplicate?
		// It's easier to check for it here in a generic manner, rather than writing in some "history"
		// boondoggle to *all* the DataSources.
		if(this.displayFifo.has(newEvent) == false ){
			// If it's kosher, add in the new item
			var newInfoBox = new InfoBox({
				content: newEvent.renderToHtml(),
				position: newEvent.getPosition(),
				disableAutoPan: true,
				closeBoxURL: "",
				boxClass: "event-container"
			});
			this.displayFifo.unshift(newInfoBox);
			newInfoBox.open(mapObject);
			
			// Are we going to have to pop the last element off?
			if(this.displayFifo.length > maxItems) {
				var outgoing = this.displayFifo.pop();
				outgoing.close();
			}
		}
	}	
}

// Given a set interval, categories of events and the distribution in whicht they'll be presented to
// a paried MapManager, and the actual events (online, though),
// set a worker thread to dispensing these events out at the given interval in the given distributions
// to the paired MapManager.

// (Why not make categories updatable online as well? Because either everything must be updated online
// or nothing, and frankly having none is easier to implement right now.)

// Remember to explicitly destruct() when you're done so we can clean up the web worker!
function EventDispenser(pairedMM, dispenseIntervalSecs, categoryDistribParis) {
	// in the future, timer should response to "set" messages as well.

	// Dumb implementation: just hand the events over as they're recieved to the MapManager right now.
	this.pushEvents = function(category, arrayOfEvents) {
	
		_.each(arrayOfEvents, function(event) {
			console.log(event);
			pairedMM.pushEvent(event);
		})
	};
	
	// Push a failure notification to the "notification FIFO" of the map display.
	this.pushFailure = function(category, errorMessage) {
		// Well, noop actually.
	}
	
	this.destruct = function() {
	
	};
}

// A Twitter data source that gets data from GET search - demonstrates the data source interface.
// Usually paired with their own Event subclass.
function TwitterDataSource() {
	// Future data sources: do we need to get something like a client ID? Thank god this is stateless.
	
	// Asynchronous! We pass it a latLng bounds (usually taken from a Map control itself), and a continuation target - an EventDispenser;
	this.huntEventsForBounds = function(googLatLngBounds, contEventDispenser) {
		$.ajax("http://search.twitter.com/search.json?" + $.param({
			geocode: googLatLngBounds.getCenter().toUrlValue() + "," + 
			  google.maps.geometry.spherical.computeDistanceBetween(googLatLngBounds.getCenter(), googLatLngBounds.getNorthEast(), 6378.1) + "km"
		}), {
			crossDomain: true,
			dataType: "jsonp",
			async: true,
			success: function(data, status, XHR) {
				// Sort result structs into two baskets: one that have lat-long data, and ones that require geocoding from the "location" field given by Twitter's REST API.
				var geocodingRequired = new Array();
				var noGeocodingRequired = new Array();
							
				for(i = 0; i < data.results.length; ++i) {
					var rawResult = data.results[i];
				
					if(rawResult.geo != null) {
						noGeocodingRequired.unshift(rawResult);
					} else if(rawResult.geo == null && rawResult.location != null) {
						geocodingRequired.unshift(rawResult);
					}
				}
				
				// Shove the ones that don't need geocoding in first.
				contEventDispenser.pushEvents("twitter",
					_.map(noGeocodingRequired, function(result) {
						return new TwitterEvent(result, new google.maps.LatLng(result.geo.coordinates[0], result.geo.coordinates[1]));
					})
				);
				
				// Process the ones that require geocoding by handing them (and their continuations)
				// over to the Google geocoder - the callback given will add them to the EventDispenser.
				// LOOKS UNUSUAL because it's been unrolled into some tail-recursing abortion.
				var timer = "hooray for gc semantics";
				var recurse = function(geocodables) {
					if(geocodables.length > 0) {
						var toGeocode = _.first(geocodables);
						
						SharedGeocoder.geocode({address: toGeocode.location}, function(results, status) {
							if(status == google.maps.GeocoderStatus.OK) {
								var calculatedLatLng = results[0].geometry.location;
								contEventDispenser.pushEvents("twitter", [new TwitterEvent(toGeocode, calculatedLatLng)]);
							}
							setTimeout(function() {
								recurse(_.rest(geocodables));
							}, 250);
						});
					}
				}
				recurse(geocodingRequired);				
			},
			error: function(XHR, textStatus, exceptionObject) {
				var errorMessage = null;
				switch(textStatus) {
					case "timeout":
						errorMessage = "Your browser took too long to ask and get a reply from Twitter";
						break;
					case "error":
						errorMessage = "This website's coding fouled up trying to reach Twitter. Get a dev!";
						break;
					case "abort":
						errorMessage = "You've closed your browser's connection to Twitter.";
						break;
					case "parsererror":
						errorMessage = "Twitter's reply was garbled or got garbled.";
						break;
					default:
						errorMessage = "This website's code fouled up in the skunkworks. Get a dev and ask him to blame JQuery!";
						break;
				}
				contEventDispenser.pushFailure("twitter", errorMessage);
			}
		});
	};
}
function TwitterEvent(srcJson, latLng) {
	this.location = latLng;
	
	this.renderToHtml = function() {
		return srcJson.text;
	}
	
	this.getPosition = function() {
		return this.location;
	}
}

// Shared geocoder instance.
SharedGeocoder = new google.maps.Geocoder();