#!/usr/bin/env node

//
// # Saitek Pro Flight Switch Panel HID Controller
// MIT Licensed
// Copyright 2014- Nick Baugh <niftylettuce@gmail.com>
//
var MAGNETO_OFF = { name: "Magneto", paths: ["/json/controls/switches/magnetos"], key: 13 };
var MAGNETO_LEFT = { name: "Magneto", paths: ["/json/controls/switches/magnetos"], key: 15 };
var MAGNETO_RIGHT = { name: "Magneto", paths: ["/json/controls/switches/magnetos"], key: 14 };
var MAGNETO_BOTH = { name: "Magneto", paths: ["/json/controls/switches/magnetos"], key: 0 };
var STARTER = { name: "Starter", paths: ["/json/controls/switches/starter"], key: 1 };
var GEAR_UP = { name: "Gear", paths: ["/json/controls/gear/gear-down"], key: 2 };
var GEAR_DOWN = { name: "Gear", paths: ["/json/controls/gear/gear-down"], key: 3 };
var MASTER_BAT = { name: "Master Battery", paths: ["/json/controls/switches/master-bat"], key: 16 };
var MASTER_ALT = { name: "Master Alt", paths: ["/json/controls/switches/master-alt"], key: 17 };
var MASTER_AVIONICS = { name: "Master Avionics", paths: ["/json/controls/switches/master-avionics"], key: 18 };
var FUEL_PUMP = { name: "Fuel Pump", paths: ["/json/controls/engines/engine/fuel-pump"], key: 19 };
var DE_ICE = { name: "De-Ice", paths: ["/json/controls/anti-ice/window-heat", "/json/controls/anti-ice/wing-heat", "/json/controls/anti-ice/engine/carb-heat", "/json/controls/anti-ice/engine/inlet-heat"], key: 20 };
var PITOT_HEAT = { name: "Pitot Heat", paths: ["/json/controls/anti-ice/pitot-heat"], key: 21 };
var COWL = { name: "Cowl", paths: ["/json/controls/engines/engine/cowl-flaps-norm"], key: 22 };
var DASHBOARD_LIGHT = { name: "Dashboard Light", paths: ["/json/controls/lighting/panel-norm", "/json/controls/lighting/radio-norm"], key: 23 };
var BEACON_LIGHT = { name: "Beacon Light", paths: ["/json/controls/lighting/beacon"], key: 8 };
var NAV_LIGHT = { name: "Nav Light", paths: ["/json/controls/lighting/nav-lights"], key: 9 };
var STROBE_LIGHT = { name: "Strobe Light", paths: ["/json/controls/lighting/strobe"], key: 10 };
var TAXI_LIGHT = { name: "Taxi Light", paths: ["/json/controls/lighting/taxi-light"], key: 11 };
var LANDING_LIGHT = { name: "Landing Light", paths: ["/json/controls/lighting/landing-lights"], key: 12 };
var PANEL = [MAGNETO_OFF, MAGNETO_LEFT, MAGNETO_RIGHT, MAGNETO_BOTH, STARTER, GEAR_UP, GEAR_DOWN, MASTER_BAT, MASTER_ALT, MASTER_AVIONICS, FUEL_PUMP, DE_ICE, PITOT_HEAT, COWL, DASHBOARD_LIGHT, BEACON_LIGHT, NAV_LIGHT, STROBE_LIGHT, TAXI_LIGHT, LANDING_LIGHT];

var log = require('loglevel').getLogger("app");
var _ = require('underscore');
var HID = require('node-hid');
var http = require('http');
var chalk = require('chalk');

var devices = HID.devices();

var productName = 'Saitek Pro Flight Switch Panel';

var HOST = "localhost";
var PORT = 5000;

var deviceFound = _.findWhere(devices, {
    product: productName
});

// Add functionality to arrays
Array.prototype.diff = function(b) {
    var a = this;
    var forward = a.filter(function(i) {return b.indexOf(i) < 0;});
    var backward = b.filter(function(i) {return a.indexOf(i) < 0;});
    return forward.concat(backward);
};

function init() {
    // Process any passed arguments
    for(var i = 0; i < process.argv.length; i++) {
        // Set the default level to ERROR
        if(i === 0) log.setLevel(log.levels.ERROR);
        // If an argument is passed for a different loglevel, implement it
        if(process.argv[i].includes("--loglevel=")) {
            var argument = process.argv[i].split("=")[1];
            if(argument === "trace" || argument === "all") log.setLevel(log.levels.TRACE, true);
            if(argument === "debug") log.setLevel(log.levels.DEBUG, true);
            if(argument === "info") log.setLevel(log.levels.INFO, true);
            if(argument === "warn") log.setLevel(log.levels.WARN, true);
            if(argument === "error") log.setLevel(log.levels.ERROR, true);
        }
    }

    if (_.isUndefined(deviceFound)) {
        return log.error(chalk.red('%s was not found as a connected HID device'), productName);
    } else {
        return log.info(chalk.green('%s was found as a connected HID device'), productName);
    }
}

init();

function change(flippedSwitch, value) {
    flippedSwitch.paths.forEach(function(path){
        var body = JSON.stringify(({"value" : value }));
        log.debug(chalk.gray("Post with body: ") + chalk.magenta(body));

        var request = new http.ClientRequest({
            hostname: HOST,
            port: PORT,
            path: path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            }
        });

        log.debug(chalk.magenta("Created request with host: %s, port: %s, path: %s, method: POST."), HOST, PORT, path);

        request.end(body);

        request.on('response', function(response) {
            if(response.statusCode !== 200) {
                log.error(chalk.gray("STATUS: ") + chalk.red(response.statusCode));
                log.error(chalk.gray("HEADERS: ") + chalk.red(JSON.stringify(response.headers)));
            } else {
                log.debug(chalk.gray("STATUS: ") + chalk.green(response.statusCode));
            }
        });

        process.on('uncaughtException', function (err) {
            log.error(chalk.red("error"), err);
        });

        if (value) {
            log.info(chalk.green(flippedSwitch.name + " turned ON"));
        } else {
            log.info(chalk.red(flippedSwitch.name + " turned OFF"));
        }
    });
}

/** Decodes the bytecode from the switch panel to integers **/
function getBitIndexFlipped(a, b) {
  var fieldA = 0, fieldB = 0;
  for (var i=0; i<a.length; i++) fieldA = (fieldA << 8) | a[i]
  for (var z=0; z<b.length; z++) fieldB = (fieldB << 8) | b[z]
  var diff = fieldA ^ fieldB;
  var retval = [];
  var count = 0;
  while (diff > 0) {
    if (diff & 0x01 > 0) retval[retval.length] = count;
    diff = diff >> 1;
    count++
  }
  return retval
}

var device = new HID.HID(deviceFound.path);

var presentControls = [];
var previousControls = [];

/** Returns true if the index is present in the presentControls array
/** Meaning that the physical switch is flipped ON **/
function on(controlIndex) {
  return _.contains(presentControls, controlIndex)
}

/** This function processes the flipped switch.
/** It defines what the switch value should become and requests the change. **/
function processFlippedSwitch(flippedSwitch) {

    if(flippedSwitch.name === MAGNETO_OFF.name) { // MAGNETO_OFF / LEFT / RIGHT / BOTH are all named "Magneto"
        if(on(flippedSwitch.key)) {
            log.debug(chalk.cyan("The magneto switch is active and should be changed."));
            switch (flippedSwitch.key) {
                case MAGNETO_OFF.key :
                    change(flippedSwitch, 0);
                    break;
                case MAGNETO_LEFT.key :
                    change(flippedSwitch, 1);
                    break;
                case MAGNETO_RIGHT.key :
                    change(flippedSwitch, 2);
                    break;
                case MAGNETO_BOTH.key :
                    change(flippedSwitch, 3);
                    break;
                default :
                    log.warn(chalk.yellow("State of physical magneto changed, but could not change virtual state."));
            }
        } else {
            log.debug(chalk.cyan("The magneto switch is active, but state has not changed."));
        }
    } else if(flippedSwitch.name === GEAR_DOWN.name) {

        // Check if the changed switch is gear. We can sent information back to the device to change the LED lights.
        log.debug(chalk.cyan("The gear was switched. We'll change the landing gear lights."));
        if (on(GEAR_DOWN.key)) {
            change(flippedSwitch, true);
            device.sendFeatureReport([0x00, 0x01 | 0x02 | 0x04]);
        } else if (on(GEAR_UP.key)) {
            change(flippedSwitch, false);
            device.sendFeatureReport([0x00, 0x08 | 0x10 |0x20 ])
        }

    } else if(flippedSwitch.name === COWL.name || flippedSwitch.name === DASHBOARD_LIGHT.name) {
        change(flippedSwitch, on(flippedSwitch.key) ? 1 : 0);
    } else {
        // The default value is false or true, so we can change the virtual state
        change(flippedSwitch, on(flippedSwitch.key));
    }
}

/** When a switch is flipped on the device, the device data is processed here **/
device.on('data', function(data) {

    presentControls = getBitIndexFlipped([], data);

    log.info(chalk.cyan('Switches:'), presentControls);
    log.debug(chalk.cyan('Previous switch status:'), previousControls);

    // Define which switches have a changed status
    var difference = presentControls.diff(previousControls);

    // Set the previousControls to the new ones
    previousControls = presentControls.slice();

    // Now iterate the PANEL to see if that part of the panel is affected
    PANEL.forEach(function(panelEntry) {
        // Iterate the changed input
        difference.forEach(function(differenceEntry) {
            if(panelEntry.key === differenceEntry) {
                log.debug(chalk.cyan("The %s is switched with value %s."), panelEntry.name, panelEntry.key)
                processFlippedSwitch(panelEntry);
            }
        })
    });
});

device.on('error', function(err) {
  log.error(chalk.red('err'), err)
});


// Top Green = 0x01 =   0001
// Left Green = 0x02 =  0010
// Right Green = 0x04 = 0100
//                      0111
//
// 0001 OR 0010 = 0011
// 0011 OR 0100 = 0111

// Top Red = 0x08
// Left Red = 0x10
// Right Red = 0x20

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators

// all green
//device.write([0x0, 0x01 | 0x02 | 0x04 ])

// nothing
//device.write([0x0, 0x0])

// all red
//device.write([0x0, 0x08 | 0x10 | 0x20 ])

// all green except right
//device.write([0x0, 0x01 | 0x02 | 0x04 ^ 0x04])

// lg, rg, tr
//device.write([0x0, 0x02 | 0x04 | 0x08])
