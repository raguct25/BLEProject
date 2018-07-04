import React, { Component } from "react";
import {
  Platform,
  PermissionsAndroid, // for checking if certain android permissions are enabled
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  NativeEventEmitter, // for emitting events for the BLE manager
  NativeModules, // for getting an instance of the BLE manager module
  Button,
  ToastAndroid, // for showing notification if there's a new attendee
  FlatList, // for creating lists
  Alert
} from "react-native";
import BleManager from "react-native-ble-manager"; // for talking to BLE peripherals
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule); // create an event emitter for the BLE Manager module

import { stringToBytes } from "convert-string"; // for converting string to byte array
import RandomId from "random-id"; // for generating random user ID
import bytesCounter from "bytes-counter"; // for getting the number of bytes in a string
import Spinner from "react-native-spinkit"; // for showing a spinner when loading something
// import Prompt from "react-native-prompt"; // for showing an input prompt
import prompt from "react-native-prompt-android";

export default class PusherBle extends Component {
  constructor() {
    super();
    this.state = {
      is_scanning: false, // whether the app is currently scanning for peripherals or not
      peripherals: null, // the peripherals detected
      connected_peripheral: null, // the currently connected peripheral
      user_id: null, // the ID of the current user
      attendees: null, // the attendees currently synced with the app
      promptVisible: false, // whether the prompt for the user's name is visible or not
      has_attended: false // whether the current user has already attended
    };
    this.peripherals = []; // temporary storage for the detected peripherals
  }
  componentWillMount() {
    BleManager.enableBluetooth()
      .then(() => {
        console.log("Bluetooth is already enabled");
      })
      .catch(error => {
        Alert.alert("You need to enable bluetooth to use this app.");
      });

    // initialize the BLE module
    BleManager.start({ showAlert: false }).then(() => {
      console.log("Module initialized");
    });

    if (Platform.OS === "android" && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      ).then(result => {
        if (!result) {
          PermissionsAndroid.requestPermission(
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
          ).then(result => {
            if (!result) {
              Alert.alert(
                "You need to give access to coarse location to use this app."
              );
            }
          });
        }
      });
    }
  }

  componentDidMount() {
    bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      peripheral => {
        var peripherals = this.peripherals; // get the peripherals
        // check if the peripheral already exists
        var el = peripherals.filter(el => {
          return el.id === peripheral.id;
        });

        if (!el.length) {
          peripherals.push({
            id: peripheral.id, // mac address of the peripheral
            name: peripheral.name // descriptive name given to the peripheral
          });
          this.peripherals = peripherals; // update the array of peripherals
          console.log(peripheral, "peripheral");
        }
      }
    );

    bleManagerEmitter.addListener("BleManagerStopScan", () => {
      console.log("scan stopped");
      if (this.peripherals.length == 0) {
        Alert.alert("Nothing found", "Sorry, no peripherals were found");
      }
      this.setState(
        {
          is_scanning: false,
          peripherals: this.peripherals
        },
        () => console.log(this.state, "current sate")
      );
    });
    //this.startScan();
  }

  startScan = () => {
    this.peripherals = [];
    this.setState({
      is_scanning: true
    });

    BleManager.scan([], 4).then(() => {
      console.log("scan started");
    });
  };

  connect(peripheral_id) {
    console.log(typeof peripheral_id);
    BleManager.connect(peripheral_id)
      .then(() => {
        this.setState({
          connected_peripheral: peripheral_id
        });
        Alert.alert("Connected!", "You are now connected to the peripheral.");
        // retrieve the services advertised by this peripheral
        BleManager.retrieveServices(peripheral_id).then(peripheralInfo => {
          console.log("Peripheral info:", peripheralInfo);
        });
      })
      .catch(error => {
        Alert.alert("Err..", "Something went wrong while trying to connect.");
      });
  }

  // Attend later
  attend(value) {
    let user_id = RandomId(15);
    console.log(value, "value");
    this.setState({
      user_id: user_id
    });

    let me = {
      id: user_id,
      full_name: value
    };

    let str = JSON.stringify(me); // convert the object to a string
    let bytes = bytesCounter.count(str); // count the number of bytes
    let data = stringToBytes(str); // convert the string to a byte array

    // construct the UUIDs the same way it was constructed in the server component earlier
    const BASE_UUID = "-5659-402b-aeb3-d2f7dcd1b999";
    const PERIPHERAL_ID = "0000";
    const PRIMARY_SERVICE_ID = "0100";

    let primary_service_uuid = PERIPHERAL_ID + PRIMARY_SERVICE_ID + BASE_UUID; // the service UUID
    let ps_characteristic_uuid = PERIPHERAL_ID + "0300" + BASE_UUID; // the characteristic ID to write on

    // write the attendees info to the characteristic
    BleManager.write(
      this.state.connected_peripheral,
      primary_service_uuid,
      ps_characteristic_uuid,
      data,
      bytes
    )
      .then(() => {
        this.setState({
          has_attended: true
        });
        // disconnect to the peripheral
        BleManager.disconnect(this.state.connected_peripheral)
          .then(() => {
            Alert.alert(
              "Attended",
              "You have successfully attended the event, please disable bluetooth."
            );
          })
          .catch(error => {
            Alert.alert(
              "Error disconnecting",
              "You have successfully attended the event but there's a problem disconnecting to the peripheral, please disable bluetooth to force disconnection."
            );
          });
      })
      .catch(error => {
        Alert.alert(
          "Error attending",
          "Something went wrong while trying to attend. Please try again."
        );
        console.log(error);
      });
  }

  openBox() {
    this.setState({
      promptVisible: true
    });
  }

  renderItem({ item }) {
    if (item.full_name) {
      return (
        <View style={styles.list_item} key={item.id}>
          <Text style={styles.list_item_text}>{item.full_name}</Text>
          <Text style={styles.list_item_text}>{item.time_entered}</Text>
        </View>
      );
    }

    return (
      <View style={styles.list_item} key={item.id}>
        <Text style={styles.list_item_text}>{item.name}</Text>

        <Button
          title="Connect"
          color="#1491ee"
          style={styles.list_item_button}
          onPress={this.connect.bind(this, item.id)}
        />
      </View>
    );
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.app_title}>
            <Text style={styles.header_text}>BLE-Pusher Attendance</Text>
          </View>
          <View style={styles.header_button_container}>
            {!this.state.connected_peripheral && (
              <Button title="Scan" color="#1491ee" onPress={this.startScan} />
            )}
          </View>
        </View>
        <View style={styles.body}>
          <Spinner
            size={50}
            type={"WanderingCubes"}
            color={"#6097FC"}
            isVisible={this.state.is_scanning}
            style={styles.spinner}
          />

          <FlatList
            data={this.state.peripherals}
            renderItem={this.renderItem.bind(this)}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: "stretch",
    backgroundColor: "#F5FCFF"
  },
  header: {
    flex: 1,
    backgroundColor: "#3B3738",
    flexDirection: "row"
  },
  app_title: {
    flex: 7,
    padding: 10
  },
  header_button_container: {
    flex: 2,
    justifyContent: "center",
    paddingRight: 5
  },
  header_text: {
    fontSize: 20,
    color: "#FFF",
    fontWeight: "bold"
  },
  body: {
    flex: 19
  },
  list_item: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 15,
    paddingBottom: 15,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    flex: 1,
    flexDirection: "row"
  },
  list_item_text: {
    flex: 8,
    color: "#575757",
    fontSize: 18
  },
  list_item_button: {
    flex: 2
  },
  spinner: {
    alignSelf: "center",
    marginTop: 30
  },
  attendees_container: {
    flex: 1
  }
});
