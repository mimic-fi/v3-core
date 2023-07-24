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

import '@mimic-fi/v3-connectors/contracts/liquidity/convex/ConvexConnector.sol';

import './BaseConvexTask.sol';
import '../../interfaces/liquidity/convex/IConvexClaimer.sol';

/**
 * @title Convex claimer
 */
contract ConvexClaimer is IConvexClaimer, BaseConvexTask {
    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('CONVEX_CLAIMER');

    /**
     * @dev Convex claim config. Only used in the initializer.
     */
    struct ConvexClaimConfig {
        BaseConvexConfig baseConvexConfig;
    }

    /**
     * @dev Initializes a Convex claimer
     * @param config Convex claim config
     */
    function initialize(ConvexClaimConfig memory config) external virtual initializer {
        __ConvexClaimer_init(config);
    }

    /**
     * @dev Initializes the Convex claimer. It does call upper contracts initializers.
     * @param config Convex claim config
     */
    function __ConvexClaimer_init(ConvexClaimConfig memory config) internal onlyInitializing {
        __BaseConvexTask_init(config.baseConvexConfig);
        __ConvexClaimer_init_unchained(config);
    }

    /**
     * @dev Initializes the Convex claimer. It does not call upper contracts initializers.
     * @param config Convex claim config
     */
    function __ConvexClaimer_init_unchained(ConvexClaimConfig memory config) internal onlyInitializing {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Tells the address from where the token amounts to execute this task are fetched
     */
    function getTokensSource() external view virtual override(IBaseTask, BaseTask) returns (address) {
        return address(ConvexConnector(connector).booster());
    }

    /**
     * @dev Tells the amount a task should use for a token, in this case always zero since it is not possible to
     * compute on-chain how many tokens are available to be claimed.
     */
    function getTaskAmount(address) external pure virtual override(IBaseTask, BaseTask) returns (uint256) {
        return 0;
    }

    /**
     * @dev Execute Convex claimer
     * @param token Address of the Convex pool token to claim rewards for
     * @param amount Must be zero, it is not possible to claim a specific number of tokens
     */
    function call(address token, uint256 amount) external override authP(authParams(token)) {
        _beforeConvexClaimer(token, amount);
        bytes memory connectorData = abi.encodeWithSelector(ConvexConnector.claim.selector, token);
        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        (address[] memory tokens, uint256[] memory amounts) = abi.decode(result, (address[], uint256[]));
        _afterConvexClaimer(token, amount, tokens, amounts);
    }

    /**
     * @dev Before Convex claimer hook
     */
    function _beforeConvexClaimer(address token, uint256 amount) internal virtual {
        _beforeBaseConvexTask(token, amount);
        if (amount != 0) revert TaskAmountNotZero();
    }

    /**
     * @dev After Convex claimer hook
     */
    function _afterConvexClaimer(
        address tokenIn,
        uint256 amountIn,
        address[] memory tokensOut,
        uint256[] memory amountsOut
    ) internal virtual {
        if (tokensOut.length != amountsOut.length) revert ClaimerInvalidResultLength(tokensOut.length, amountsOut.length);
        for (uint256 i = 0; i < tokensOut.length; i++) _increaseBalanceConnector(tokensOut[i], amountsOut[i]);
        _afterBaseConvexTask(tokenIn, amountIn);
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
}
