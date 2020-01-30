'use strict';

var app = angular.module('applyMyRideApp');

app.directive('jqdatepicker', function() {
  return {
    require : 'ngModel',
    link : function (scope, element, attrs, ngModelCtrl) {

      scope.isRTDHoliday = function(date) {
        // requires moment.js exist in the runtime environment
        let m = moment(date);
        let _holidays = {
          'date': { // Month, Day
            '01/01': 'New Year\'s Day',
            '07/04': 'Independence Day',
            '12/25': 'Christmas Day'
          },
          // these rule keys are basically a custom dsl for defining date rules
          'rule': { // Month, nth day-name of the Month (-1 is last day-name of the month), Day of Week
            '5/-1/1': 'Memorial Day', // last monday in May
            '9/1/1': 'Labor Day', // first monday in September
            '11/4/4': 'Thanksgiving Day' // fourth thursday in November
          }
        };
        // determine which day-name of the month is the passed-in date
        // ex. the 3rd Monday will return 3, the 2nd Tuesday will return 2
        // the 0 | part is a bitwise operator. Just smile and nod your head... it works ¯\_(ツ)_/¯
        let dayInMonth = 1 + (0 | ((m.date() - 1) / 7));
        // if the passed in date is a last day of the month (ex last Monday or last Tuesday) then set to '-1'
        let lastDayInMonth = (m.date() + 7 > m.daysInMonth()) && '-1';

        // Returns false, or the name of the holiday as a string
        // returns a holiday name if the formatted date matches one of the holiday dates or date rules
        return _holidays.date[m.format('MM/DD')]
          || _holidays.rule[m.format(`M/${lastDayInMonth}/d`)]
          || _holidays.rule[m.format(`M/${dayInMonth}/d`)];
      }

      $(function(){
        element.datepicker({
          dateFormat:'mm/dd/yy',
          minDate: new Date(),
          onSelect:function (dateText, inst) {
            ngModelCtrl.$setViewValue(dateText);
            scope.$apply();
          },
          beforeShowDay: function(date) {
            var isHoliday = scope.isRTDHoliday(date);
            if (isHoliday) {
              var holidayWarning = isHoliday + " is an RTD Holiday. If you elect to travel on this day, the schedule may not be normal.";
              return [true, "holidayDate", holidayWarning];
            } else {
              return [true, "", "Available"];
            }
          }
        });
      });
    }
  }
});
