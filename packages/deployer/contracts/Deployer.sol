// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at you[r option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import 'solmate/src/utils/CREATE3.sol';
import '@openzeppelin/contracts/utils/Address.sol';

import '@mimic-fi/v3-authorizer/contracts/Authorizer.sol';
import '@mimic-fi/v3-price-oracle/contracts/PriceOracle.sol';
import '@mimic-fi/v3-smart-vault/contracts/SmartVault.sol';
import '@mimic-fi/v3-registry/contracts/interfaces/IRegistry.sol';

contract Deployer {
    using Address for address;

    /**
     * @dev The namespace is empty
     */
    error DeployerNamespaceEmpty();

    /**
     * @dev The name is empty
     */
    error DeployerNameEmpty();

    /**
     * @dev The implementation is not registered
     */
    error DeployerImplementationNotRegistered(address implementation);

    /**
     * @dev The implementation is stateless
     */
    error DeployerImplementationStateless(address implementation);

    /**
     * @dev The implementation is deprecated
     */
    error DeployerImplementationDeprecated(address implementation);

    /**
     * @dev Emitted every time an authorizer is deployed
     */
    event AuthorizerDeployed(string namespace, string name, address instance, address implementation);

    /**
     * @dev Emitted every time a price oracle is deployed
     */
    event PriceOracleDeployed(string namespace, string name, address instance, address implementation);

    /**
     * @dev Emitted every time a smart vault is deployed
     */
    event SmartVaultDeployed(string namespace, string name, address instance, address implementation);

    /**
     * @dev Emitted every time a task is deployed
     */
    event TaskDeployed(string namespace, string name, address instance, address implementation);

    // Registry reference
    IRegistry public immutable registry;

    /**
     * @dev Creates a new Deployer contract
     * @param _registry Address of the Mimic Registry to be referenced
     */
    constructor(IRegistry _registry) {
        registry = _registry;
    }

    /**
     * @dev Authorizer params
     * @param impl Address of the Authorizer implementation to be used
     * @param owners List of addresses that will be allowed to authorize and unauthorize permissions
     */
    struct AuthorizerParams {
        address impl;
        address[] owners;
    }

    /**
     * @dev Price oracle params
     * @param impl Address of the Price Oracle implementation to be used
     * @param authorizer Address of the authorizer to be linked
     * @param signer Address of the allowed signer
     * @param pivot Address of the token to be used as the pivot
     * @param feeds List of feeds to be set for the price oracle
     */
    struct PriceOracleParams {
        address impl;
        address authorizer;
        address signer;
        address pivot;
        PriceOracle.FeedData[] feeds;
    }

    /**
     * @dev Smart vault params
     * @param impl Address of the Smart Vault implementation to be used
     * @param authorizer Address of the authorizer to be linked
     * @param priceOracle Optional price Oracle to set for the Smart Vault
     */
    struct SmartVaultParams {
        address impl;
        address authorizer;
        address priceOracle;
    }

    /**
     * @dev Task params
     * @param custom Whether the implementation is custom or not, if it is it won't be checked with Mimic's Registry
     * @param impl Address of the task implementation to be used
     * @param initializeData Call-data to initialize the new task instance
     */
    struct TaskParams {
        bool custom;
        address impl;
        bytes initializeData;
    }

    /**
     * @dev Tells the deployed address for a given input
     */
    function getAddress(address sender, string memory namespace, string memory name) external view returns (address) {
        return CREATE3.getDeployed(getSalt(sender, namespace, name));
    }

    /**
     * @dev Tells the salt for a given input
     */
    function getSalt(address sender, string memory namespace, string memory name) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sender, namespace, name));
    }

    /**
     * @dev Deploys a new authorizer instance
     */
    function deployAuthorizer(string memory namespace, string memory name, AuthorizerParams memory params) external {
        _validateImplementation(params.impl);
        address instance = _deployClone(namespace, name, params.impl);
        Authorizer(instance).initialize(params.owners);
        emit AuthorizerDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Deploys a new price oracle instance
     */
    function deployPriceOracle(string memory namespace, string memory name, PriceOracleParams memory params) external {
        _validateImplementation(params.impl);
        address instance = _deployClone(namespace, name, params.impl);
        PriceOracle(instance).initialize(params.authorizer, params.signer, params.pivot, params.feeds);
        emit PriceOracleDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Deploys a new smart vault instance
     */
    function deploySmartVault(string memory namespace, string memory name, SmartVaultParams memory params) external {
        _validateImplementation(params.impl);
        address payable instance = payable(_deployClone(namespace, name, params.impl));
        SmartVault(instance).initialize(params.authorizer, params.priceOracle);
        emit SmartVaultDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Deploys a new task instance
     */
    function deployTask(string memory namespace, string memory name, TaskParams memory params) external {
        if (!params.custom) _validateImplementation(params.impl);
        address instance = _deployClone(namespace, name, params.impl);
        if (params.initializeData.length > 0) instance.functionCall(params.initializeData, 'DEPLOYER_TASK_INIT_FAILED');
        emit TaskDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Validates if an implementation is registered, not deprecated, and considered stateful
     * @param implementation Address of the implementation to be checked
     */
    function _validateImplementation(address implementation) internal view {
        if (!registry.isRegistered(implementation)) revert DeployerImplementationNotRegistered(implementation);
        if (registry.isStateless(implementation)) revert DeployerImplementationStateless(implementation);
        if (registry.isDeprecated(implementation)) revert DeployerImplementationDeprecated(implementation);
    }

    /**
     * @dev Deploys a new clone using CREATE3
     */
    function _deployClone(string memory namespace, string memory name, address implementation)
        internal
        returns (address)
    {
        if (bytes(namespace).length == 0) revert DeployerNamespaceEmpty();
        if (bytes(name).length == 0) revert DeployerNameEmpty();

        bytes memory bytecode = abi.encodePacked(
            hex'3d602d80600a3d3981f3363d3d373d3d3d363d73',
            implementation,
            hex'5af43d82803e903d91602b57fd5bf3'
        );

        bytes32 salt = getSalt(msg.sender, namespace, name);
        return CREATE3.deploy(salt, bytecode, 0);
    }
}
