//! Live HEVC pipe over iroh.
//!
//! ```text
//! # GPU / receiver
//! iroh-hevc listen            # prints an EndpointTicket, writes Annex-B to stdout
//!
//! # Camera / sender
//! ffmpeg -i … -c:v libx265 -f hevc - | iroh-hevc send <ticket>
//! ```

use std::env;
use std::io::{Read, Write};

use anyhow::{Context, Result};
use iroh::{
    endpoint::presets,
    protocol::{ProtocolHandler, Router},
    Endpoint, EndpointAddr,
};

const ALPN: &[u8] = b"aicam/hevc/1";

#[tokio::main]
async fn main() -> Result<()> {
    let mut args = env::args().skip(1);
    match args.next().as_deref() {
        Some("listen") => listen().await,
        Some("send") => {
            let ticket = args.next().context("usage: iroh-hevc send <ticket>")?;
            send(&ticket).await
        }
        _ => {
            eprintln!("usage: iroh-hevc listen | iroh-hevc send <ticket>");
            std::process::exit(2);
        }
    }
}

async fn listen() -> Result<()> {
    let endpoint = Endpoint::bind(presets::N0).await?;
    endpoint.online().await;
    let ticket = endpoint.addr();
    eprintln!("AICAM_IROH_TICKET={ticket}");
    println!("{ticket}");
    let _router = Router::builder(endpoint).accept(ALPN, HevcSink).spawn();
    std::future::pending::<()>().await;
    Ok(())
}

async fn send(ticket: &str) -> Result<()> {
    let addr: EndpointAddr = ticket.parse().context("parse iroh endpoint addr")?;
    let endpoint = Endpoint::bind(presets::N0).await?;
    let conn = endpoint.connect(addr, ALPN).await?;
    let mut send = conn.open_uni().await?;
    let mut stdin = std::io::stdin().lock();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = stdin.read(&mut buf)?;
        if n == 0 {
            break;
        }
        send.write_all(&buf[..n]).await?;
    }
    send.finish()?;
    conn.closed().await;
    Ok(())
}

#[derive(Debug, Clone)]
struct HevcSink;

impl ProtocolHandler for HevcSink {
    async fn accept(
        &self,
        connection: iroh::endpoint::Connection,
    ) -> Result<(), iroh::protocol::AcceptError> {
        let mut recv = connection.accept_uni().await?;
        let mut stdout = std::io::stdout().lock();
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            match recv.read(&mut buf).await {
                Ok(Some(n)) => {
                    stdout.write_all(&buf[..n])?;
                    stdout.flush()?;
                }
                Ok(None) => break,
                Err(e) => return Err(iroh::protocol::AcceptError::from(e)),
            }
        }
        Ok(())
    }
}
