Parse.initialize("2Ongd4CRvxEiaxD0D8D4D7xb70YaxUUDZgYu1PAG", "IIQZk5RLPmFDfbYrJyzIhjelqb7fBwREzDqWECci");
Parse.serverURL = 'https://saharasaltsys.back4app.io';
var infoWindow, lastInfoW = 0, searchMarker, toMarker, directionsDisplay, directionsService, drawingManager, map, selectedShape, deleteMenu;

var app = angular.module('App', ['ngSanitize', 'ngRoute']);
app.config(function ($routeProvider) {
    $routeProvider.when("/", {
        templateUrl: function () {
            return Parse.User.current() ? 'views/indexContent.html' : 'views/login.html';
        }
    }).otherwise({
        templateUrl: "views/404.html"
    });
});
app.run(function ($rootScope) {
    $rootScope.user = Parse.User.current();
    $rootScope.logout = function () {
        showSpinner();
        Parse.User.logOut().then(function () {
            location.reload();
        });
    }
});
app.controller('loginCtrl', function ($scope, $rootScope) {
    hideSpinner();
    $scope.login = function () {
        if (!$scope.username || !$scope.username.length || !$scope.password || !$scope.password.length) {
            return;
        }
        showSpinner();
        Parse.User.logIn($scope.username, $scope.password, {
            success: function (user) {
                location.reload();
            },
            error: function (user, error) {
                hideSpinner();
                alert("Error: " + error.code + " " + error.message);
            }
        });
    };
});

function showInfoWindow(content, marker, map) {
    if (!infoWindow || !infoWindow.getMap() || Date.now() - lastInfoW >= 1000) {
        if (infoWindow) {
            infoWindow.close();
        }
        infoWindow = new google.maps.InfoWindow({
            content: content
        });
        infoWindow.setPosition(event.latLng);
        infoWindow.open(map, marker);
        lastInfoW = Date.now();
    }
}
function initIndex() {
    $(".button-collapse").sideNav({
        closeOnClick: true,
        draggable: true
    });

    $('#showTo').click(function () {
        $('#search-bar-to').toggle();
        if ($('#search-bar-to').is(':visible'))
            routeSearch();
        else
            directionsDisplay.setDirections({routes: []});
    });

    $('#rulerDiv').click(function () {
        addRuler();
    });
}
function initMap() {
    map = new google.maps.Map(document.getElementById('map_canvas'), {
        zoom: 10,
        center: {lat: 40.7127, lng: -74.0059},
        mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT
        },
        fullscreenControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
        },
        fullscreenControl: true,
        rotateControl: true,
        streetViewControl: true,
        scaleControl: true,
        mapTypeControl: true,
        overviewMapControl: true,
        panControl: true,
        zoomControl: true
    });
    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(map);
    directionsService = new google.maps.DirectionsService();

    var autocomplete = new google.maps.places.Autocomplete(document.getElementById('search-bar-input'));
    autocomplete.bindTo('bounds', map);
    autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (!place.geometry) {
            return;
        }
        if (searchMarker)
            searchMarker.setMap(null);
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
        searchMarker = new google.maps.Marker({
            position: place.geometry.location,
            map: map
        });
        searchMarker.addListener('click', function () {
            showInfoWindow(place.name, searchMarker, map);
        });
        routeSearch();
    });
    var autocompleteTO = new google.maps.places.Autocomplete(document.getElementById('search-bar-to'));
    autocompleteTO.bindTo('bounds', map);
    autocompleteTO.addListener('place_changed', function () {
        var place = autocompleteTO.getPlace();
        if (!place.geometry) {
            return;
        }
        if (toMarker)
            toMarker.setMap(null);
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
        toMarker = new google.maps.Marker({
            position: place.geometry.location,
            map: map
        });
        toMarker.addListener('click', function () {
            showInfoWindow(place.name, toMarker, map);
        });
        routeSearch();
    });

    map.controls[google.maps.ControlPosition.TOP_CENTER].push(document.getElementById('rulerDiv'));
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(document.getElementById('colorDiv'));

    map.controls[google.maps.ControlPosition.TOP_CENTER].push(document.getElementById('search-bar'));
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(document.getElementById('side-widget'));
    map.data.setControls(['LineString', 'Polygon', 'Point']);
    map.data.setStyle({
        editable: true,
        draggable: true
    });
    bindDataLayerListeners(map.data);

    //load saved data
    loadPolygons(map);

}
app.controller('indexCtrl', function ($scope, $rootScope) {
    initIndex();
    initMap();
    initDrawingManager();

    var Point = Parse.Object.extend("Point");
    var query = new Parse.Query(Point);
    query.include('company');
    query.include('parent');

    query.find({
        success: function (results) {
            hideSpinner();

            new CustomMarker(new google.maps.LatLng(
                results[0].get('location').latitude,
                results[0].get('location').longitude
            ), map, results[0]);


            google.maps.event.trigger(map, 'resize');
        },
        error: function (error) {
            alert("Error: " + error.code + " " + error.message);
        }
    });
});

app.controller('notFoundCtrl', function ($scope, $rootScope) {
    hideSpinner();
});

function hideSpinner() {
    $('#divLoading').fadeOut(250, function () {
        $('#divLoading').removeClass('show');
    });
}
function showSpinner() {
    $('#divLoading').fadeIn(250, function () {
        $('#divLoading').addClass('show');
    });
}

function CustomMarker(latLng, map, args) {
    this.latlng = latLng;
    this.args = args;
    this.theMap = map;
    this.setMap(map);
}
CustomMarker.prototype = new google.maps.OverlayView();
CustomMarker.prototype.draw = function () {
    var div = this.div;
    var point = this.getProjection().fromLatLngToDivPixel(this.latlng);
    if (point) {
        div.style.left = (point.x - 10) + 'px';
        div.style.top = (point.y - 20) + 'px';
    }
    if (this.theMap.getZoom() <= (this.args.get('zoomMax') || 20) && this.theMap.getZoom() >= (this.args.get('zoomMin') || 0))
        div.style.display = 'block';
    else
        div.style.display = 'none';
};
CustomMarker.prototype.remove = function () {
    if (this.div) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
    }
};
CustomMarker.prototype.getPosition = function () {
    return this.latlng;
};

CustomMarker.prototype.onAdd = function () {
    var div = this.div;
    div = this.div = document.createElement('div');
    div.className = 'marker';
    div.style.position = 'absolute';
    div.style.cursor = 'pointer';
    var innerHTML = '<i class="material-icons">' + ( this.args.get('icon') || 'place' ) + '</i>';
    div.innerHTML = innerHTML;
    var panes = this.getPanes();
    panes.overlayImage.appendChild(div);
    var self = this;
    google.maps.event.addDomListener(div, "click", function (event) {
        showInfoWindow(self.args.get('title'), self, self.theMap);
    });
};

function routeSearch() {
    if (!searchMarker || !toMarker) {
        return;
    }
    directionsService.route({
        origin: searchMarker.getPosition(),
        destination: toMarker.getPosition(),
        travelMode: 'DRIVING'
    }, function (response, status) {
        if (status === 'OK') {
            directionsDisplay.setDirections(response);
        } else {
            window.alert('Directions request failed due to ' + status);
        }
    });
}


function DeleteMenu() {
    this.div_ = document.createElement('div');
    this.div_.className = 'delete-menu';
    this.div_.innerHTML = 'Delete';

    var menu = this;
    google.maps.event.addDomListener(this.div_, 'click', function () {
        menu.removeX();
    });
}
DeleteMenu.prototype = new google.maps.OverlayView();

DeleteMenu.prototype.onAdd = function () {
    var deleteMenu = this;
    var map = this.getMap();
    this.getPanes().floatPane.appendChild(this.div_);

    this.divListener_ = google.maps.event.addDomListener(map.getDiv(), 'mousedown', function (e) {
        if (e.target != deleteMenu.div_) {
            deleteMenu.close();
        }
    }, true);
};

DeleteMenu.prototype.onRemove = function () {
    google.maps.event.removeListener(this.divListener_);
    this.div_.parentNode.removeChild(this.div_);

    this.set('position');
    this.set('path');
    this.set('vertex');
};

DeleteMenu.prototype.close = function () {
    this.setMap(null);
};

DeleteMenu.prototype.draw = function () {
    var position = this.get('position');
    var projection = this.getProjection();

    if (!position || !projection) {
        return;
    }

    var point = projection.fromLatLngToDivPixel(position);
    this.div_.style.top = point.y + 'px';
    this.div_.style.left = point.x + 'px';
};


DeleteMenu.prototype.open = function (map, object, e, callback) {
    if (e.vertex) {
        this.set('path', object.getPath());
        this.set('vertex', e.vertex);
        this.div_.innerHTML = 'Delete Vertex';
    } else {
        this.div_.innerHTML = 'Delete';
    }

    this.set('position', e.latLng);
    this.set('callback', callback);
    this.setMap(map);
    this.draw();
};

DeleteMenu.prototype.removeX = function () {
    var path = this.get('path');
    var vertex = this.get('vertex');
    var callback = this.get('callback');

    if (callback) {
        callback();
        this.close();
        return;
    }

    if (!path || vertex == undefined) {
        deleteSelectedShape();
        this.close();
        return;
    }

    path.removeAt(vertex);
    this.close();
};


function clearSelection() {
    if (selectedShape) {
        if (selectedShape.type !== 'marker') {
            selectedShape.setEditable(false);
        }

        selectedShape = null;
    }
}

function setSelection(shape) {
    if (shape.type !== 'marker') {
        clearSelection();
        shape.setEditable(true);
        selectColor(shape.get('fillColor') || shape.get('strokeColor'));
    }

    selectedShape = shape;
}

function deleteSelectedShape() {
    if (selectedShape) {
        selectedShape.setMap(null);
    }
}

function selectColor(color) {
    var polylineOptions = drawingManager.get('polylineOptions');
    polylineOptions.strokeColor = color;
    drawingManager.set('polylineOptions', polylineOptions);

    var rectangleOptions = drawingManager.get('rectangleOptions');
    rectangleOptions.fillColor = color;
    drawingManager.set('rectangleOptions', rectangleOptions);

    var circleOptions = drawingManager.get('circleOptions');
    circleOptions.fillColor = color;
    drawingManager.set('circleOptions', circleOptions);

    var polygonOptions = drawingManager.get('polygonOptions');
    polygonOptions.fillColor = color;
    drawingManager.set('polygonOptions', polygonOptions);
}

function setSelectedShapeColor(color) {
    if (selectedShape) {
        if (selectedShape.type == google.maps.drawing.OverlayType.POLYLINE) {
            selectedShape.set('strokeColor', color);
        } else {
            selectedShape.set('fillColor', color);
        }
    }
}


function initDrawingManager() {

    var polyOptions = {
        strokeWeight: 0,
        fillOpacity: 0.45,
        editable: true,
        draggable: true
    };
    drawingManager = new google.maps.drawing.DrawingManager({
        markerOptions: {
            draggable: true
        },
        polylineOptions: {
            editable: true,
            draggable: true
        },
        rectangleOptions: polyOptions,
        circleOptions: polyOptions,
        polygonOptions: polyOptions,
        map: map,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: ['marker', 'circle', 'polygon', 'polyline', 'rectangle']
        }
    });
    deleteMenu = new DeleteMenu();

    google.maps.event.addListener(drawingManager, 'overlaycomplete', function (e) {
        var newShape = e.overlay;

        newShape.type = e.type;

        drawingManager.setDrawingMode(null);
        google.maps.event.addListener(newShape, 'click', function (e) {
            setSelection(newShape);
        });
        setSelection(newShape);
        google.maps.event.addListener(newShape, 'rightclick', function (e) {
            deleteMenu.open(map, newShape, e);
        });
    });
    google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);
    google.maps.event.addListener(map, 'click', clearSelection);
    $('#colorPlatte').change(function () {
        selectColor($('#colorPlatte').val());
        setSelectedShapeColor($('#colorPlatte').val());
    });
    selectColor($('#colorPlatte').val());
}

function addRuler() {

    var ruler1 = new google.maps.Marker({
        position: map.getCenter(),
        map: map,
        draggable: true
    });

    var ruler2 = new google.maps.Marker({
        position: map.getCenter(),
        map: map,
        draggable: true
    });

    var ruler1label = new Label({map: map});
    var ruler2label = new Label({map: map});
    ruler1label.bindTo('position', ruler1, 'position');
    ruler2label.bindTo('position', ruler2, 'position');

   var rulerpoly = new google.maps.Polyline({
        path: [ruler1.position, ruler2.position],
        strokeColor: "#FFFF00",
        strokeOpacity: .7,
        strokeWeight: 3
    });
    rulerpoly.setMap(map);

    ruler1label.set('text', "0m");
    ruler2label.set('text', "0m");

    google.maps.event.addListener(ruler1, 'drag', function () {
        rulerpoly.setPath([ruler1.getPosition(), ruler2.getPosition()]);
        ruler1label.set('text', distance(ruler1.getPosition().lat(), ruler1.getPosition().lng(), ruler2.getPosition().lat(), ruler2.getPosition().lng()));
        ruler2label.set('text', distance(ruler1.getPosition().lat(), ruler1.getPosition().lng(), ruler2.getPosition().lat(), ruler2.getPosition().lng()));
    });

    google.maps.event.addListener(ruler2, 'drag', function () {
        rulerpoly.setPath([ruler1.getPosition(), ruler2.getPosition()]);
        ruler1label.set('text', distance(ruler1.getPosition().lat(), ruler1.getPosition().lng(), ruler2.getPosition().lat(), ruler2.getPosition().lng()));
        ruler2label.set('text', distance(ruler1.getPosition().lat(), ruler1.getPosition().lng(), ruler2.getPosition().lat(), ruler2.getPosition().lng()));
    });

    google.maps.event.addListener(ruler1, 'rightclick', function (e) {
        deleteMenu.open(map, ruler1, e, function () {
            ruler1.setMap(null);
            ruler2.setMap(null);
            rulerpoly.setMap(null);
            ruler1label.onRemove();
            ruler2label.onRemove();
        });
    });
    google.maps.event.addListener(ruler2, 'rightclick', function (e) {
        deleteMenu.open(map, ruler2, e, function () {
            ruler1.setMap(null);
            ruler2.setMap(null);
            rulerpoly.setMap(null);
            ruler1label.onRemove();
            ruler2label.onRemove();
        });
    });
}

function distance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    if (d > 1) return Math.round(d) + "km";
    else if (d <= 1) return Math.round(d * 1000) + "m";
    return d;
}

function Label(opt_options) {
    // Initialization
    this.setValues(opt_options);

    // Label specific
    var span = this.span_ = document.createElement('span');
    span.style.cssText = 'position: relative; left: 0%; top: -8px; ' +
        'white-space: nowrap; border: 0px; font-family:arial; font-weight:bold;' +
        'padding: 2px; background-color: #ddd; ' +
        'opacity: .75; ' +
        'filter: alpha(opacity=75); ' +
        '-ms-filter: "alpha(opacity=75)"; ' +
        '-khtml-opacity: .75; ' +
        '-moz-opacity: .75;';

    var div = this.div_ = document.createElement('div');
    div.appendChild(span);
    div.style.cssText = 'position: absolute; display: none';
};
Label.prototype = new google.maps.OverlayView;

// Implement onAdd
Label.prototype.onAdd = function () {
    var pane = this.getPanes().overlayLayer;
    pane.appendChild(this.div_);


    // Ensures the label is redrawn if the text or position is changed.
    var me = this;
    this.listeners_ = [
        google.maps.event.addListener(this, 'position_changed',
            function () {
                me.draw();
            }),
        google.maps.event.addListener(this, 'text_changed',
            function () {
                me.draw();
            })
    ];

};

// Implement onRemove
Label.prototype.onRemove = function () {
    this.div_.parentNode.removeChild(this.div_);
    // Label is removed from the map, stop updating its position/text.
    for (var i = 0, I = this.listeners_.length; i < I; ++i) {
        google.maps.event.removeListener(this.listeners_[i]);
    }
};

// Implement draw
Label.prototype.draw = function () {
    var projection = this.getProjection();
    var position = projection.fromLatLngToDivPixel(this.get('position'));

    var div = this.div_;
    div.style.left = position.x + 'px';
    div.style.top = position.y + 'px';
    div.style.display = 'block';

    this.span_.innerHTML = this.get('text').toString();
};

function bindDataLayerListeners(dataLayer) {
    dataLayer.addListener('addfeature', savePolygon);
    dataLayer.addListener('removefeature', savePolygon);
    dataLayer.addListener('setgeometry', savePolygon);
}

function loadPolygons(map) {
    var data = JSON.parse(localStorage.getItem('geoData'));

    map.data.forEach(function (f) {
        map.data.remove(f);
    });
    map.data.addGeoJson(data)
}



function savePolygon() {
    map.data.toGeoJson(function (json) {
        localStorage.setItem('geoData', JSON.stringify(json));
    });
}