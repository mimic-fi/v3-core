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

pragma solidity >=0.8.0;

interface IDeployer {
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

    /**
     * @dev Tells the registry address
     */
    function registry() external view returns (address);

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
        FeedData[] feeds;
    }

    /**
     * @dev Price oracle feed data
     * @param base Token to rate
     * @param quote Token used for the price rate
     * @param feed Price feed address
     */
    struct FeedData {
        address base;
        address quote;
        address feed;
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
    function getAddress(address sender, string memory namespace, string memory name) external view returns (address);

    /**
     * @dev Tells the salt for a given input
     */
    function getSalt(address sender, string memory namespace, string memory name) external pure returns (bytes32);

    /**
     * @dev Deploys a new authorizer instance
     */
    function deployAuthorizer(string memory namespace, string memory name, AuthorizerParams memory params) external;

    /**
     * @dev Deploys a new price oracle instance
     */
    function deployPriceOracle(string memory namespace, string memory name, PriceOracleParams memory params) external;

    /**
     * @dev Deploys a new smart vault instance
     */
    function deploySmartVault(string memory namespace, string memory name, SmartVaultParams memory params) external;

    /**
     * @dev Deploys a new task instance
     */
    function deployTask(string memory namespace, string memory name, TaskParams memory params) external;
}
