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

pragma solidity ^0.8.0;

import '@mimic-fi/v3-helpers/contracts/utils/Denominations.sol';

import '../Task.sol';
import '../interfaces/primitives/ICollector.sol';

/**
 * @title Collector
 * @dev Task that offers a source address where funds can be pulled from
 */
contract Collector is ICollector, Task {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('COLLECTOR');

    // Address from where the tokens will be pulled
    address internal _tokensSource;

    /**
     * @dev Collect config. Only used in the initializer.
     */
    struct CollectConfig {
        address tokensSource;
        TaskConfig taskConfig;
    }

    /**
     * @dev Initializes the collector
     * @param config Collect config
     */
    function initialize(CollectConfig memory config) external virtual initializer {
        __Collector_init(config);
    }

    /**
     * @dev Initializes the collector. It does call upper contracts initializers.
     * @param config Collect config
     */
    function __Collector_init(CollectConfig memory config) internal onlyInitializing {
        __Task_init(config.taskConfig);
        __Collector_init_unchained(config);
    }

    /**
     * @dev Initializes the collector. It does not call upper contracts initializers.
     * @param config Collect config
     */
    function __Collector_init_unchained(CollectConfig memory config) internal onlyInitializing {
        _setTokensSource(config.tokensSource);
    }

    /**
     * @dev Tells the address from where the token amounts to execute this task are fetched
     */
    function getTokensSource() public view virtual override(IBaseTask, BaseTask) returns (address) {
        return _tokensSource;
    }

    /**
     * @dev Sets the tokens source address. Sender must be authorized.
     * @param tokensSource Address of the tokens source to be set
     */
    function setTokensSource(address tokensSource) external override authP(authParams(tokensSource)) {
        _setTokensSource(tokensSource);
    }

    /**
     * @dev Execute Collector
     */
    function call(address token, uint256 amount) external override authP(authParams(token, amount)) {
        _beforeCollector(token, amount);
        ISmartVault(smartVault).collect(token, _tokensSource, amount);
        _afterCollector(token, amount);
    }

    /**
     * @dev Before collector hook
     */
    function _beforeCollector(address token, uint256 amount) internal virtual {
        _beforeTask(token, amount);
        if (token == address(0)) revert TaskTokenZero();
        if (amount == 0) revert TaskAmountZero();
    }

    /**
     * @dev After collector hook
     */
    function _afterCollector(address token, uint256 amount) internal virtual {
        _increaseBalanceConnector(token, amount);
        _afterTask(token, amount);
    }

    /**
     * @dev Sets the balance connectors. Previous balance connector must be unset.
     * @param previous Balance connector id of the previous task in the workflow
     * @param next Balance connector id of the next task in the workflow
     */
    function _setBalanceConnectors(bytes32 previous, bytes32 next) internal virtual override {
        if (previous != bytes32(0)) revert TaskPreviousConnectorNotZero(previous);
        super._setBalanceConnectors(previous, next);
    }

    /**
     * @dev Sets the source address
     * @param tokensSource Address of the tokens source to be set
     */
    function _setTokensSource(address tokensSource) internal virtual {
        if (tokensSource == address(0)) revert TaskTokensSourceZero();
        _tokensSource = tokensSource;
        emit TokensSourceSet(tokensSource);
    }
}
