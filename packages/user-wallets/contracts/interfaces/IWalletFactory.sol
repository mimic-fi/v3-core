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

/**
 * @dev Wallet Factory interface
 */
interface IWalletFactory {
    /**
     * @dev The name is empty
     */
    error WalletFactoryNameEmpty();

    /**
     * @dev The implementation is zero
     */
    error WalletFactoryImplementationZero();

    /**
     * @dev Emitted every time a wallet is deployed
     */
    event WalletDeployed(string name, address instance, address implementation);

    /**
     * @dev Tells the deployed address for a given input using CREATE3
     */
    function getAddress(address sender, string memory name) external view returns (address);

    /**
     * @dev Tells the deployed address for a given input using CREATE2
     */
    function getAddressCreate2(address sender, string memory name, address implementation)
        external
        view
        returns (address);

    /**
     * @dev Tells the salt for a given input
     */
    function getSalt(address sender, string memory name) external pure returns (bytes32);

    /**
     * @dev Deploys a new wallet instance using CREATE3
     */
    function deployWallet(string memory name, address implementation) external;

    /**
     * @dev Deploys a new wallet instance using CREATE2
     */
    function deployWalletCreate2(string memory name, address implementation) external;
}
