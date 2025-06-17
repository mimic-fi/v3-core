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

import '@mimic-fi/helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/helpers/contracts/utils/BytesHelpers.sol';
import '@mimic-fi/v3-connectors/contracts/interfaces/generic/IGenericSwapConnector.sol';

import './BaseSwapTask.sol';
import '../interfaces/swap/IGenericSwapper.sol';

/**
 * @title Generic swapper
 * @dev Task that extends the base swap task to use the Generic Swap connector
 */
contract GenericSwapper is IGenericSwapper, BaseSwapTask {
    using FixedPoint for uint256;
    using BytesHelpers for bytes;

    // Execution type for relayers
    bytes32 public constant override EXECUTION_TYPE = keccak256('GENERIC_SWAPPER');

    // List of allowed swap targets
    mapping (address => bool) public override isTargetAllowed;

    /**
     * @dev Generic swap config. Only used in the initializer.
     */
    struct GenericSwapConfig {
        address[] allowedTargets;
        BaseSwapConfig baseSwapConfig;
    }

    /**
     * @dev Initializes the Generic swapper
     * @param config Generic swap config
     */
    function initialize(GenericSwapConfig memory config) external virtual initializer {
        __GenericSwapper_init(config);
    }

    /**
     * @dev Initializes the Generic swapper. It does call upper contracts initializers.
     * @param config Generic swap config
     */
    function __GenericSwapper_init(GenericSwapConfig memory config) internal onlyInitializing {
        __BaseSwapTask_init(config.baseSwapConfig);
        __GenericSwapper_init_unchained(config);
    }

    /**
     * @dev Initializes the Generic swapper. It does not call upper contracts initializers.
     * @param config Generic swap config
     */
    function __GenericSwapper_init_unchained(GenericSwapConfig memory config) internal onlyInitializing {
        for (uint256 i = 0; i < config.allowedTargets.length; i++) {
            _setSwapTarget(config.allowedTargets[i], true);
        }
    }

    /**
     * @dev Sets a list of target allowances
     * @param targets List of swap targets to be set
     * @param allowances Whether each swap target is allowed
     */
    function setSwapTargets(address[] memory targets, bool[] memory allowances) external auth {
        if (targets.length != allowances.length) revert TaskTargetSetInputLengthMismatch();
        for (uint256 i = 0; i < targets.length; i++) {
            _setSwapTarget(targets[i], allowances[i]);
        }
    }

    /**
     * @dev Executes the Generic swapper
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address targetCall,
        address targetApproval,
        bytes memory data
    ) external override authP(authParams(tokenIn, amountIn, slippage)) {
        if (amountIn == 0) amountIn = getTaskAmount(tokenIn);
        _beforeGenericSwapper(tokenIn, amountIn, slippage, targetCall);

        address tokenOut = getTokenOut(tokenIn);
        uint256 price = _getPrice(tokenIn, tokenOut);
        uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
        bytes memory connectorData = abi.encodeWithSelector(
            IGenericSwapConnector.execute.selector,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            targetCall,
            targetApproval,
            data
        );

        bytes memory result = ISmartVault(smartVault).execute(connector, connectorData);
        _afterGenericSwapper(tokenIn, amountIn, slippage, tokenOut, result.toUint256());
    }

    /**
     * @dev Before Generic swapper hook
     */
    function _beforeGenericSwapper(address token, uint256 amount, uint256 slippage, address target) internal virtual {
        _beforeBaseSwapTask(token, amount, slippage);
        if (!isTargetAllowed[target]) revert TaskSwapTargetNotAllowed();
    }

    /**
     * @dev After Generic swapper hook
     */
    function _afterGenericSwapper(
        address tokenIn,
        uint256 amountIn,
        uint256 slippage,
        address tokenOut,
        uint256 amountOut
    ) internal virtual {
        _afterBaseSwapTask(tokenIn, amountIn, slippage, tokenOut, amountOut);
    }

    /**
     * @dev Sets the allow condition for a swap target
     * @param target Address of the swap target to be set
     * @param allowed Whether the swap target is allowed
     */
    function _setSwapTarget(address target, bool allowed) internal {
        if (target == address(0)) revert TaskSwapTargetZero();
        isTargetAllowed[target] = allowed;
        emit SwapTargetSet(target, allowed);
    }
}
