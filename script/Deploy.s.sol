// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/PaymentDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock USDC
        ERC20PresetMinterPauser usdc = new ERC20PresetMinterPauser("USDC", "USDC");
        
        // Deploy PaymentDistributor
        PaymentDistributor distributor = new PaymentDistributor(address(usdc));

        // Mint some USDC for testing
        usdc.mint(deployer, 1000000 * 10**6); // 1M USDC

        vm.stopBroadcast();

        console.log("Deployer address:", deployer);
        console.log("USDC deployed to:", address(usdc));
        console.log("PaymentDistributor deployed to:", address(distributor));
    }
}
