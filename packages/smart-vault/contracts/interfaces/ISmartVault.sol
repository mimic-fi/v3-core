// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity >=0.8.0;

import '@mimic-fi/v3-authorizer/contracts/interfaces/IAuthorized.sol';
import '@mimic-fi/v3-price-oracle/contracts/interfaces/IPriceFeedProvider.sol';

/**
 * @dev Smart Vault interface
 */
interface ISmartVault is IAuthorized, IPriceFeedProvider {
    /**
     * @dev Emitted every time the price oracle is set
     */
    event PriceOracleSet(address indexed priceOracle);

    /**
     * @dev Emitted every time a price feed is set for (base, quote) pair
     */
    event PriceFeedSet(address indexed base, address indexed quote, address feed);

    /**
     * @dev Emitted every time a dependency check is overridden
     */
    event DependencyCheckOverridden(address indexed dependency, bool ignored);

    /**
     * @dev Emitted every time `execute` is called
     */
    event Executed(address indexed connector, bytes data, bytes result);

    /**
     * @dev Emitted every time `call` is called
     */
    event Called(address indexed target, bytes data, uint256 value, bytes result);

    /**
     * @dev Emitted every time `wrap` is called
     */
    event Wrapped(uint256 amount);

    /**
     * @dev Emitted every time `unwrap` is called
     */
    event Unwrapped(uint256 amount);

    /**
     * @dev Emitted every time `collect` is called
     */
    event Collected(address indexed token, address indexed from, uint256 amount);

    /**
     * @dev Emitted every time `withdraw` is called
     */
    event Withdrawn(address indexed token, address indexed recipient, uint256 amount, uint256 fee);

    /**
     * @dev Tells the address of the price oracle
     */
    function priceOracle() external view returns (address);

    /**
     * @dev Tells the address of the Mimic's registry
     */
    function registry() external view returns (address);

    /**
     * @dev Tells the address of the Mimic's fee controller
     */
    function feeController() external view returns (address);

    /**
     * @dev Tells the address of the wrapped native token
     */
    function wrappedNativeToken() external view returns (address);

    /**
     * @dev Tells if a dependency check is ignored
     * @param dependency Address of the dependency being queried
     */
    function isDependencyCheckIgnored(address dependency) external view returns (bool);

    /**
     * @dev Tells the price of a token (base) in a given quote
     * @param base Token to rate
     * @param quote Token used for the price rate
     */
    function getPrice(address base, address quote) external view returns (uint256);

    /**
     * @dev Tells the price feed address for (base, quote) pair. It returns the zero address if there is no one set.
     * @param base Token to be rated
     * @param quote Token used for the price rate
     */
    function getPriceFeed(address base, address quote) external view returns (address);

    /**
     * @dev Sets the price oracle
     * @param newPriceOracle Address of the new price oracle to be set
     */
    function setPriceOracle(address newPriceOracle) external;

    /**
     * @dev Sets a of price feed
     * @param base Token base to be set
     * @param quote Token quote to be set
     * @param feed Price feed to be set
     */
    function setPriceFeed(address base, address quote, address feed) external;

    /**
     * @dev Overrides dependency checks
     * @param dependency Address of the dependency to override its check
     * @param ignored Whether the dependency check should be ignored
     */
    function overrideDependencyCheck(address dependency, bool ignored) external;

    /**
     * @dev Executes a connector inside of the Smart Vault context
     * @param connector Address of the connector that will be executed
     * @param data Call data to be used for the delegate-call
     * @return result Call response if it was successful, otherwise it reverts
     */
    function execute(address connector, bytes memory data) external returns (bytes memory result);

    /**
     * @dev Executes an arbitrary call from the Smart Vault
     * @param target Address where the call will be sent
     * @param data Call data to be used for the call
     * @param value Value in wei that will be attached to the call
     * @return result Call response if it was successful, otherwise it reverts
     */
    function call(address target, bytes memory data, uint256 value) external returns (bytes memory result);

    /**
     * @dev Wrap an amount of native tokens to the wrapped ERC20 version of it
     * @param amount Amount of native tokens to be wrapped
     */
    function wrap(uint256 amount) external;

    /**
     * @dev Unwrap an amount of wrapped native tokens
     * @param amount Amount of wrapped native tokens to unwrapped
     */
    function unwrap(uint256 amount) external;

    /**
     * @dev Collect tokens from an external account to the Smart Vault
     * @param token Address of the token to be collected
     * @param from Address where the tokens will be transfer from
     * @param amount Amount of tokens to be transferred
     */
    function collect(address token, address from, uint256 amount) external;

    /**
     * @dev Withdraw tokens to an external account
     * @param token Address of the token to be withdrawn
     * @param recipient Address where the tokens will be transferred to
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(address token, address recipient, uint256 amount) external;
}
