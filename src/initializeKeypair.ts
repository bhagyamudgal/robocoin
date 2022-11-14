import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import base58 from "bs58";
import dotenv from "dotenv";
dotenv.config();

export async function initializeKeypair(connection: Connection) {
	const privateKey = process.env.PRIVATE_KEY ?? "";
	const secretKey = base58.decode(privateKey);
	const keypairFromSecretKey = Keypair.fromSecretKey(secretKey);
	await airdropSolIfNeeded(keypairFromSecretKey, connection);
	return keypairFromSecretKey;
}

async function airdropSolIfNeeded(signer: Keypair, connection: Connection) {
	const balance = await connection.getBalance(signer.publicKey);
	console.log("Current balance is", balance / LAMPORTS_PER_SOL);

	if (balance < LAMPORTS_PER_SOL) {
		console.log("Airdropping 1 SOL...");
		const airdropSignature = await connection.requestAirdrop(
			signer.publicKey,
			LAMPORTS_PER_SOL
		);

		const latestBlockHash = await connection.getLatestBlockhash();

		await connection.confirmTransaction({
			blockhash: latestBlockHash.blockhash,
			lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
			signature: airdropSignature,
		});

		const newBalance = await connection.getBalance(signer.publicKey);
		console.log("New balance is", newBalance / LAMPORTS_PER_SOL);
	}
}
