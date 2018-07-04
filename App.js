import React, { Component } from "react";
import {
  Text,
  View,
  TouchableHighlight,
  NativeEventEmitter,
  Platform,
  ScrollView,
  Alert,
  NativeModules,
  TouchableOpacity,
  PermissionsAndroid
} from "react-native";
import BleManager from "react-native-ble-manager";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

class App extends Component {
  constructor() {
    super();
    this.state = {
      ble: [],
      scanning: false
    };
  }
  componentWillMount(){
    BleManager.enableBluetooth()
  .then(() => {
    console.log('The bluetooth is already enabled or the user confirm');
  })
  .catch((error) => {
    console.log('The user refuse to enable bluetooth');
  });
  }

  componentDidMount() {
    BleManager.start();
    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
    bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      this.handleDiscoverPeripheral
    );

    if (Platform.OS === "android" && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      ).then(result => {
        if (result) {
          console.log("Permission is OK");
        } else {
          PermissionsAndroid.requestPermission(
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
          ).then(result => {
            if (result) {
              console.log("User accept");
            } else {
              console.log("User refuse");
            }
          });
        }
      });
    }
    bleManagerEmitter.addListener("BleManagerStopScan", () => {
      console.log("scan stopped");
      if (this.state.ble.length == 0) {
        Alert.alert("Nothing found", "Sorry, no peripherals were found");
      }
      this.setState(
        {
          scanning: false
        },
        () => console.log(this.state, "current sate")
      );
    });
  }

  handleScan() {
    BleManager.scan([], 2, true).then(results => {
      console.log("Scanning...");
    });
  }

  toggleScanning=(bool)=> {
    if (bool) {
      this.setState({ scanning: true });
      this.handleScan()
    } else {
      this.setState({ scanning: false, ble: [] });
    }
  }

  handleDiscoverPeripheral(data) {
    console.log("Got ble data");

    if(this.state.ble.indexOf(data) ===-1){
      console.log("Got ud ", this.state.ble.indexOf(data));
      this.setState({ ble: [...this.state.ble, data] }, () => {
        console.log(this.state.ble);
      });
    }
  }

  connectToPheripherial=(peripheral)=>{
    console.log('ID',peripheral.id);
      BleManager.connect(peripheral.id)
    .then((data) => {
      console.log('Connected', data);
      BleManager.retrieveServices(peripheral.id).then(peripheralInfo => {
        console.log("Peripheral info:", peripheralInfo);
      })
      .catch(error => {
        Alert.alert("Err..", "Something went wrong while trying to connect.");
      });
    })
    .catch((error) => {
      console.log(error);
    });
  }

  render() {
    const container = {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#F5FCFF"
    };

    const bleList = this.state.ble.length > 0 ?(

      this.state.ble.map((value,i)=>(
        <TouchableOpacity  key={i} onPress={()=> this.connectToPheripherial(value)}
          style={{ padding: 20, backgroundColor: "blue",  margin:10 }}>
        <Text> Device found: {value.name} </Text>
        </TouchableOpacity>
      ))
    ) : (

      <Text>no devices nearby</Text>
    );

    return (

      <View style={container}>
        <TouchableHighlight
          style={{ padding: 20, backgroundColor: "#ccc" }}
          onPress={() => this.toggleScanning(!this.state.scanning)}
        >
          <Text>Scan Bluetooth ({this.state.scanning ? "on" : "off"})</Text>
        </TouchableHighlight>
        <ScrollView>
        {bleList}
        </ScrollView>
      </View>

    );
  }
}

export default App;
