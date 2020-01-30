/* --- Made by justgoscha and licensed under MIT license --- */

var app = angular.module('autocomplete', []);

app.directive('autocomplete', ['localStorageService', '$timeout', function(localStorageService, $timeout) {
  var index = -1;

  return {
    restrict: 'E',
    scope: {
      searchParam: '=ngModel',
      suggestions: '=data',
      onType: '=onType',
      onSelect: '=onSelect',
      onFocus: '=onFocus',
      autocompleteRequired: '=',
      disableFilter: '=disableFilter',
      iter: '@'
    },
    controller: ['$scope', function($scope){

      $timeout(function(){
        $scope.handleSynonyms();
      });

      $scope.clearInput = function($event){
        $event.stopPropagation();
        $scope.select();
        $scope.setIndex(-1);
        $scope.searchParam = null;
      }

      // the index of the suggestions that's currently selected
      $scope.selectedIndex = -1;

      $scope.initLock = true;

      // set new index
      $scope.setIndex = function(i){
        $scope.selectedIndex = parseInt(i);
      };

      this.setIndex = function(i){
        $scope.setIndex(i);
        $scope.$apply();
      };

      $scope.getIndex = function(i){
        return $scope.selectedIndex;
      };

      // watches if the parameter filter should be changed
      var watching = true;

      // autocompleting drop down on/off
      $scope.completing = false;

      // starts autocompleting on typing in something
      $scope.$watch('searchParam', function(newValue, oldValue){

        $scope.handleSynonyms();

        if($scope.$parent.pauseAutocomplete){
          $scope.$parent.handlePausedAutocomplete($scope.attrs.ngmodel, $scope.searchParam);
          return;
        }

        if(newValue == ''){
          $scope.select();
          $scope.setIndex(-1);
        }

        if (oldValue === newValue || (!oldValue && $scope.initLock)) {
          return;
        }

        $scope.$parent.handleLocationEdit(newValue, oldValue, $scope.attrs.iter);

        if(watching && typeof $scope.searchParam !== 'undefined' && $scope.searchParam !== null && !$scope.$parent.pauseAutocomplete) {
          $scope.completing = true;
          $scope.searchFilter = $scope.disableFilter ? '' : $scope.searchParam;
          $scope.selectedIndex = -1;
        }

        // function thats passed to on-type attribute gets executed
        if($scope.onType)
          $scope.onType($scope.searchParam);
      });

      // for hovering over suggestions
      this.preSelect = function(suggestion){

        watching = false;

        // this line determines if it is shown
        // in the input field before it's selected:
        //$scope.searchParam = suggestion;

        $scope.$apply();
        watching = true;

      };

      $scope.preSelect = this.preSelect;

      this.preSelectOff = function(){
        watching = true;
      };

      $scope.preSelectOff = this.preSelectOff;

      $scope.handleSynonyms = function(){
        var searchParam = $scope.searchParam;
        if(!searchParam || searchParam.length < 1)
          return;
        var searchParam = $scope.searchParam;
        searchParam = searchParam.replace(/\s\s+/g, ' ');  //coalesce multiple spaces
        var parentScope = $scope;
        while(parentScope.$parent && !parentScope.synonyms){
          parentScope = parentScope.$parent;
        }

        var elements = searchParam.split(/[ ]+/);
        for(var i = 0; i < elements.length; i++) {
          if(i < elements.length - 1){
            var matchIndex = Object.keys(parentScope.synonyms).indexOf(elements[i].toUpperCase());
            if(matchIndex > -1){
              var synonymKey = Object.keys(parentScope.synonyms)[matchIndex];
              elements[i] = parentScope.synonyms[synonymKey];
            }
          }
        }
        var updatedSearchParam = elements.join(" ");
        if(updatedSearchParam != searchParam){
          console.log('replaced synonyms: ' + searchParam + " " + updatedSearchParam);
          $scope.searchParam = updatedSearchParam;
        }
      }

      // selecting a suggestion with RIGHT ARROW or ENTER
      $scope.select = function(suggestion){
        if(suggestion){
          suggestion = suggestion.replace(/^\s+/g, ''); //ltrim
          suggestion = suggestion.replace(/\s+$/g, ''); //rtrim
          $scope.searchParam = suggestion;
          $scope.searchFilter = suggestion;
          if($scope.onSelect){
            if($scope.attrs.iter){
              $scope.onSelect(suggestion, $scope.attrs.iter);
            }else{
              $scope.onSelect(suggestion);
            }
          }
        }
        $scope.blurWait = false;
        watching = false;
        $scope.completing = false;
        setTimeout(function(){watching = true;},1000);
        $scope.setIndex(-1);
      };

      $scope.ignoreBlur = function(){
        $scope.blurWait = true;
      }
    }],
    link: function(scope, element, attrs, ctrls){

      setTimeout(function() {
        scope.initLock = false;
        scope.$apply();
      }, 250);

      var attr = '';

      // Default atts
      scope.attrs = {
        "placeholder": "start typing...",
        "class": "",
        "id": "",
        "inputclass": "",
        "inputid": "",
      };

      for (var a in attrs) {
        attr = a.replace('attr', '').toLowerCase();
        // add attribute overriding defaults
        // and preventing duplication
        if (a.indexOf('attr') === -1) {
          scope.attrs[attr] = attrs[a];
        }
      }

      if (attrs.clickActivation) {
        element[0].onclick = function(e){
          if(!scope.searchParam){
            setTimeout(function() {
              scope.completing = true;
              scope.$apply();
            }, 200);
          }
        };
      }

      var key = {left: 37, up: 38, right: 39, down: 40 , enter: 13, esc: 27, tab: 9};

      document.addEventListener("keydown", function(e){
        var keycode = e.keyCode || e.which;
        switch (keycode){
          case key.esc:
            // disable suggestions on escape
            scope.select();
            scope.setIndex(-1);
            scope.$apply();
            e.preventDefault();
        }
      }, true)

      document.addEventListener("blur", function(e){
        // disable suggestions on blur
        // we do a timeout to prevent hiding it before a click event is registered
        setTimeout(function() {
          if(scope.blurWait == true){return;}
          scope.select();
          scope.setIndex(-1);
          scope.$apply();
        }, 750);
      }, true);

      element[0].addEventListener("keydown",function (e){
        var keycode = e.keyCode || e.which;
        var l = angular.element(this).find('li').length;

        // this allows submitting forms by pressing Enter in the autocompleted field
        if(!scope.completing || l == 0)
          return;

        // implementation of the up and down movement in the list of suggestions
        switch (keycode){
          case key.up:

            index = scope.getIndex()-1;

            if(index<-1){
              index = l-1;
            } else if (index >= l ){
              index = -1;
              scope.setIndex(index);
              scope.preSelectOff();
              break;
            }
            if(!scope.suggestions[index].option){
              index--;
            }

            scope.setIndex(index);

            if(index!==-1)
              scope.preSelect(angular.element(angular.element(this).find('li')[index]).text());

            scope.$apply();

            break;
          case key.down:
            index = scope.getIndex()+1;
            if(index<-1){
              index = l-1;
            } else if (index >= l ){
              index = -1;
              scope.setIndex(index);
              scope.preSelectOff();
              scope.$apply();
              break;
            }
            if(!scope.suggestions[index].option){
              index++;
            }
            scope.setIndex(index);

            if(index!==-1)
              scope.preSelect(angular.element(angular.element(this).find('li')[index]).text());

            break;
          case key.left:
            break;
          case key.right:
          case key.enter:
          case key.tab:

            index = scope.getIndex();
            // scope.preSelectOff();
            if(index !== -1) {
              scope.select(angular.element(angular.element(this).find('li')[index]).text());
              if(keycode == key.enter) {
                e.preventDefault();
              }
            } else {
              if(keycode == key.enter) {
                scope.select();
              }
            }
            scope.setIndex(-1);
            scope.$apply();

            break;
          case key.esc:
            // disable suggestions on escape
            scope.select();
            scope.setIndex(-1);
            scope.$apply();
            e.preventDefault();
            break;
          default:
            return;
        }

      });
    },
    template: '\
        <div class="autocomplete {{ attrs.class }}" id="{{ attrs.id }}">\
          <input\
            type="text"\
            click-to-focus="{{ attrs.clicktofocus }}"\
            focus-me="{{ attrs.autofocus }}"\
            ng-model="searchParam"\
            placeholder="{{ attrs.placeholder }}"\
            class="{{ attrs.inputclass }} autocomplete__input"\
            id="{{ attrs.inputid }}"\
            ng-required="{{ autocompleteRequired }}"\
            ng-trim="false"\
            />\
          <div class="autocomplete__suggestions active" role="listbox" ng-show="completing && (suggestions | filter:searchFilter).length > 0">\
            <ul class="autocomplete__groups" role="presentation">\
              <li\
                suggestion\
                ng-repeat="suggestion in suggestions"\
                index="{{ $index }}"\
                val="{{ suggestion.label }}"\
                ng-click="!suggestion.option || select(suggestion.label)"\
                ng-mousedown="ignoreBlur()"\
                class="autocomplete__group"\
                role="presentation"\
                >\
                <div class="autocomplete__group--name active" role="presentation"  ng-bind-html="suggestion.label" ng-if="!suggestion.option"></div>\
                <button class="autocomplete__link" role="option" type="button" ng-if="suggestion.option"\
                  ng-class="{ active: ($index === selectedIndex && suggestion.option)}">\
                  <div class="autocomplete__link--content">\
                    <div class="autocomplete__link--name" ng-bind-html="suggestion.label"></div>\
                  </div>\
                </button>\
              </li>\
            </ul>\
          </div>\
          <span ng-click="clearInput($event)" class="searchclear glyphicon glyphicon-remove-circle"></span>\
        </div>'
  };
}]);

app.filter('highlight', ['$sce', function ($sce) {
  return function (input, searchParam) {
    if (typeof input === 'function') return '';
    if (searchParam) {
      var words = '(' +
              searchParam.split(/\ /).join(' |') + '|' +
              searchParam.split(/\ /).join('|') +
              ')',
          exp = new RegExp(words, 'gi');
      if (words.length) {
        input = input.replace(exp, "<span class=\"highlight\">$1</span>");
      }
    }
    return $sce.trustAsHtml(input);
  };
}]);


app.directive('clickToFocus',
    ['$window', function ($window) {
      return {
        link: function(scope, element) {
          element.on('click', function () {
            if (!$window.getSelection().toString()) {
              // Required for mobile Safari
              this.setSelectionRange(0, this.value.length)
            }
          });
        }
      };
    }]
);
app.directive('focusMe', function($timeout) {
  return {
    scope: { trigger: '@focusMe' },
    link: function(scope, element) {
      scope.$watch('trigger', function(value) {
        if(value === "true") {
          $timeout(function() {
            element[0].focus();
          });
        }
      });
    }
  };
});
app.directive('suggestion', function(){
  return {
    restrict: 'A',
    require: '^autocomplete', // ^look for controller on parents element
    link: function(scope, element, attrs, autoCtrl){
      element.bind('mouseenter', function() {
        autoCtrl.preSelect(attrs.val);
        autoCtrl.setIndex(attrs.index);
      });

      element.bind('mouseleave', function() {
        autoCtrl.preSelectOff();
      });
    }
  };
});
