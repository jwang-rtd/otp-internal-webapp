RTD trip planner replacement
================

Get updated package information. Note that this step applies if using apt-get on Linux. Use a different tool on Mac OS.

sudo apt-get update

Install Node.js and npm. Can skip this step if already installed.

sudo apt-get install nodejs npm

although the app doesn't use ruby, build process requires haml rubygem installed.

gem install haml

gem install compass

npm install grunt-contrib-compass --save-dev

npm install

bower install

Build the source code.

grunt build
