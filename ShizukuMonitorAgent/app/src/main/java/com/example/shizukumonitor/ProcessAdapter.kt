package com.example.shizukumonitor

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.shizukumonitor.model.ProcessInfo

class ProcessAdapter : RecyclerView.Adapter<ProcessAdapter.Holder>() {
    private val items = mutableListOf<ProcessInfo>()

    fun submit(next: List<ProcessInfo>) {
        items.clear()
        items.addAll(next)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_process, parent, false)
        return Holder(view)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val item = items[position]
        holder.title.text = item.name
        holder.meta.text = "pid ${item.pid}  ppid ${item.ppid}  ${item.user}  ${"%.1f".format(item.memoryMB)} MB"
    }

    override fun getItemCount(): Int = items.size

    class Holder(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.title)
        val meta: TextView = view.findViewById(R.id.meta)
    }
}
