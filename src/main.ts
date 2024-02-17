import { Field, MerkleTree, Provable, assert } from 'o1js';
import { DynamicMerkleTree, MerkleNode } from './DynamicMerkleTree.js';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

(async () => {
  const effectiveMerkleTree = new DynamicMerkleTree(16);

  const merkleTree = new MerkleTree(16);

  console.log('Generate nodes');
  const nodes = generateNodes(10000, 16);

  console.log('test merkle tree');
  let startTime = performance.now();

  for (const node of nodes) {
    merkleTree.setLeaf(node.index, node.digest);
  }

  let endTime = performance.now();

  let duration = endTime - startTime;
  console.log(`test merkle tree execution time: ${duration} milliseconds`);

  console.log('effective merkle tree');

  startTime = performance.now();

  effectiveMerkleTree.setLeaves(nodes);

  endTime = performance.now();

  duration = endTime - startTime;
  console.log(`effective merkle tree execution time: ${duration} milliseconds`);

  Provable.log('effective merkle tree root', effectiveMerkleTree.getRoot());
  Provable.log('test merkle tree root', merkleTree.getRoot());

  assert(merkleTree.getRoot().equals(effectiveMerkleTree.getRoot()))
})();

function generateNodes(amount: number, merkleTreeHeight: number): MerkleNode[] {
  const nodes: Set<MerkleNode> = new Set();
  const maxLeafIndex = 2n ** BigInt(merkleTreeHeight - 1) - 1n;

  console.log('maxLeafIndex', maxLeafIndex);

  for (let i = 0; i < amount; i += 1) {
    const randomIndex = randomBigInt(maxLeafIndex);
    nodes.add({
      level: 0,
      index: randomIndex,
      digest: Field(i + 1),
    });
  }

  return Array.from(nodes);
}

function randomBigInt(max: bigint): bigint {
  const randomBytes = crypto.randomBytes(max.toString(16).length);
  const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
  return randomBigInt % (max + 1n);
}
