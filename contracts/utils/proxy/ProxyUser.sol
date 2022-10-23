pragma solidity ^0.8.0;

import "@prb/proxy/contracts/IPRBProxy.sol";
import "@prb/proxy/contracts/IPRBProxyRegistry.sol";

contract ProxyUser {

    IPRBProxy public proxy;
    IPRBProxyRegistry public registry;

    constructor() {

    }
}
